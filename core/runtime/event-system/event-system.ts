import { createStructuredError } from '../plugin-runtime/runtime-types.ts';

const toSortedUniqueEvents = (eventNames: unknown, pluginId: string) => {
  if (eventNames === undefined) {
    return [];
  }

  if (!Array.isArray(eventNames)) {
    throw new Error(`manifest.exportedEvents for ${pluginId} must be a string array when provided`);
  }

  const names = eventNames.map((name) => {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(`manifest.exportedEvents for ${pluginId} contains an invalid event name`);
    }

    return name;
  });

  return Array.from(new Set(names)).sort();
};

export class EventSystem {
  constructor(options = {}) {
    this.logger = options.logger;
    this.eventTrace = options.eventTrace;
    this.pluginEvents = new Map();
    this.eventDeclarations = new Map();
    this.pluginLoadOrder = new Map();
    this.pluginSubscriptions = new Map();
    this.subscriptionsByEvent = new Map();
    this.subscriptionSequence = 0;
    this.dispatchQueue = Promise.resolve();
    this.internalSubscriptions = new Map();
    this.internalSequence = 0;
    this.internalDispatchQueue = Promise.resolve();
    this.healthReporter = options.healthReporter;
  }

  onInternal(eventName, handler) {
    if (typeof eventName !== 'string' || eventName.trim().length === 0) {
      throw new Error('internal event name must be a non-empty string');
    }

    if (typeof handler !== 'function') {
      throw new Error(`internal event handler for "${eventName}" must be a function`);
    }

    const subscription = {
      id: ++this.internalSequence,
      eventName,
      handler,
      active: true
    };

    const subscriptions = this.internalSubscriptions.get(eventName) ?? [];
    subscriptions.push(subscription);
    this.internalSubscriptions.set(eventName, subscriptions);

    return () => {
      if (!subscription.active) {
        return;
      }

      subscription.active = false;
      this.internalSubscriptions.set(
        eventName,
        (this.internalSubscriptions.get(eventName) ?? []).filter((entry) => entry.id !== subscription.id)
      );
    };
  }

  async emitInternal(eventName, payload) {
    const dispatch = async () => {
      const subscriptions = [...(this.internalSubscriptions.get(eventName) ?? [])]
        .filter((subscription) => subscription.active)
        .sort((left, right) => left.id - right.id);

      for (const subscription of subscriptions) {
        try {
          await Promise.resolve(subscription.handler(payload));
        } catch (error) {
          this.logger?.error?.('plugin.runtime.internal-event.failure', {
            eventName,
            error: createStructuredError(error)
          });
        }
      }
    };

    this.internalDispatchQueue = this.internalDispatchQueue.then(dispatch);
    return this.internalDispatchQueue;
  }

  registerPlugin(pluginId, exportedEvents = [], loadOrder = 0) {
    const normalizedEvents = toSortedUniqueEvents(exportedEvents, pluginId);
    this.unregisterPlugin(pluginId);

    this.pluginLoadOrder.set(pluginId, loadOrder);
    this.pluginEvents.set(pluginId, new Set(normalizedEvents));

    for (const eventName of normalizedEvents) {
      if (!this.eventDeclarations.has(eventName)) {
        this.eventDeclarations.set(eventName, new Set());
      }

      this.eventDeclarations.get(eventName).add(pluginId);
    }
  }

  unregisterPlugin(pluginId) {
    const declaredEvents = this.pluginEvents.get(pluginId);
    if (declaredEvents) {
      for (const eventName of declaredEvents) {
        const providers = this.eventDeclarations.get(eventName);
        providers?.delete(pluginId);
        if (providers && providers.size === 0) {
          this.eventDeclarations.delete(eventName);
        }
      }
    }

    const subscriptions = this.pluginSubscriptions.get(pluginId) ?? [];
    for (const subscription of subscriptions) {
      subscription.active = false;
      const eventSubscriptions = this.subscriptionsByEvent.get(subscription.eventName);
      if (eventSubscriptions) {
        this.subscriptionsByEvent.set(
          subscription.eventName,
          eventSubscriptions.filter((entry) => entry.id !== subscription.id)
        );
        if (this.subscriptionsByEvent.get(subscription.eventName)?.length === 0) {
          this.subscriptionsByEvent.delete(subscription.eventName);
        }
      }
    }

    this.pluginSubscriptions.delete(pluginId);
    this.pluginEvents.delete(pluginId);
    this.pluginLoadOrder.delete(pluginId);
  }

  on(pluginId, eventName, handler) {
    this.assertEventDeclared(eventName);

    if (typeof handler !== 'function') {
      throw new Error(`event handler for ${pluginId}:${eventName} must be a function`);
    }

    const subscription = {
      id: ++this.subscriptionSequence,
      pluginId,
      eventName,
      handler,
      active: true
    };

    const subscriptions = this.subscriptionsByEvent.get(eventName) ?? [];
    subscriptions.push(subscription);
    this.subscriptionsByEvent.set(eventName, subscriptions);

    if (!this.pluginSubscriptions.has(pluginId)) {
      this.pluginSubscriptions.set(pluginId, []);
    }

    this.pluginSubscriptions.get(pluginId).push(subscription);

    return () => {
      if (!subscription.active) {
        return;
      }

      subscription.active = false;
      this.subscriptionsByEvent.set(
        eventName,
        (this.subscriptionsByEvent.get(eventName) ?? []).filter((entry) => entry.id !== subscription.id)
      );
      this.pluginSubscriptions.set(
        pluginId,
        (this.pluginSubscriptions.get(pluginId) ?? []).filter((entry) => entry.id !== subscription.id)
      );
    };
  }

  async emit(pluginId, eventName, payload) {
    this.assertPluginCanEmit(pluginId, eventName);

    const dispatch = async () => {
      const orderedSubscribers = this.getOrderedSubscribers(eventName);
      this.eventTrace?.recordEmission(
        eventName,
        pluginId,
        orderedSubscribers.filter((subscription) => subscription.active).map((subscription) => subscription.pluginId)
      );

      for (const subscription of orderedSubscribers) {
        if (!subscription.active || !this.pluginSubscriptions.has(subscription.pluginId)) {
          continue;
        }

        try {
          await Promise.resolve(
            subscription.handler(payload, Object.freeze({
              eventName,
              publisher: pluginId,
              subscriber: subscription.pluginId
            }))
          );
        } catch (error) {
          this.logger?.error?.('plugin.runtime.event.failure', {
            eventName,
            publisher: pluginId,
            subscriber: subscription.pluginId,
            error: createStructuredError(error)
          });
          void Promise.resolve().then(() => this.healthReporter?.({
            pluginId: subscription.pluginId,
            source: 'event',
            eventName,
            error
          }));
        }
      }
    };

    this.dispatchQueue = this.dispatchQueue.then(dispatch);
    return this.dispatchQueue;
  }

  getOrderedSubscribers(eventName) {
    const subscriptions = [...(this.subscriptionsByEvent.get(eventName) ?? [])];

    subscriptions.sort((left, right) => {
      const leftOrder = this.pluginLoadOrder.get(left.pluginId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = this.pluginLoadOrder.get(right.pluginId) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.id - right.id;
    });

    return subscriptions;
  }

  assertEventDeclared(eventName) {
    if (!this.eventDeclarations.has(eventName)) {
      throw new Error(`event "${eventName}" is not declared by any plugin`);
    }
  }

  assertPluginCanEmit(pluginId, eventName) {
    this.assertEventDeclared(eventName);

    const pluginEventSet = this.pluginEvents.get(pluginId);
    if (!pluginEventSet || !pluginEventSet.has(eventName)) {
      throw new Error(`plugin ${pluginId} cannot emit undeclared event "${eventName}"`);
    }
  }
}
