import { createStructuredError } from '../plugin-runtime/runtime-types.ts';

const cloneValue = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  return structuredClone(value);
};

const normalizeStateName = (name: unknown) => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('state name must be a non-empty string');
  }

  return name;
};

export class RuntimeStateStore {
  constructor(options: { logger?: { error?: (message: string, metadata?: Record<string, unknown>) => void }, eventSystem?: { emitInternal?: (eventName: string, payload: unknown) => Promise<void> }, healthReporter?: (failure: { pluginId: string, source: string, stateName?: string, error: unknown }) => Promise<void> | void } = {}) {
    this.logger = options.logger;
    this.eventSystem = options.eventSystem;
    this.healthReporter = options.healthReporter;
    this.stateByKey = new Map();
    this.subscribersByPlugin = new Map();
    this.subscriptionSequence = 0;
    this.updateQueue = Promise.resolve();
    this.stateTrace = options.stateTrace;
  }

  define(pluginId: string, name: string, initialValue: unknown) {
    const normalizedName = normalizeStateName(name);
    const key = this.createStateKey(pluginId, normalizedName);

    if (this.stateByKey.has(key)) {
      throw new Error(`state "${normalizedName}" is already defined for plugin ${pluginId}`);
    }

    this.stateByKey.set(key, {
      owner: pluginId,
      name: normalizedName,
      value: cloneValue(initialValue),
      subscribers: new Map()
    });

    void this.eventSystem?.emitInternal?.('plugin.runtime.state.defined', {
      owner: pluginId,
      name: normalizedName
    });
  }

  get(pluginId: string, name: string) {
    const stateRecord = this.getOwnedState(pluginId, name);
    return cloneValue(stateRecord.value);
  }

  update(pluginId: string, name: string, updater: (currentValue: unknown) => unknown | Promise<unknown>) {
    const normalizedName = normalizeStateName(name);
    if (typeof updater !== 'function') {
      throw new Error(`state updater for ${pluginId}:${normalizedName} must be a function`);
    }

    const executeUpdate = async () => {
      try {
        const stateRecord = this.getOwnedState(pluginId, normalizedName);
        const previousValue = cloneValue(stateRecord.value);
        const nextValue = await Promise.resolve(updater(cloneValue(stateRecord.value)));
        stateRecord.value = cloneValue(nextValue);

        const orderedSubscribers = [...stateRecord.subscribers.values()].sort((left, right) => left.id - right.id);
        for (const subscriber of orderedSubscribers) {
          if (!subscriber.active) {
            continue;
          }

          try {
            await Promise.resolve(subscriber.handler(cloneValue(stateRecord.value), {
              name: normalizedName,
              owner: pluginId,
              previousValue
            }));
          } catch (error) {
            this.logger?.error?.('plugin.runtime.state.subscriber.failure', {
              owner: pluginId,
              name: normalizedName,
              subscriber: subscriber.pluginId,
              error: createStructuredError(error)
            });
            void Promise.resolve().then(() => this.healthReporter?.({
              pluginId: subscriber.pluginId,
              source: 'state',
              stateName: normalizedName,
              error
            }));
          }
        }

        const stateKey = this.createStateKey(pluginId, normalizedName);
        this.stateTrace?.recordMutation(pluginId, stateKey);

        await this.eventSystem?.emitInternal?.('plugin.runtime.state.updated', {
          owner: pluginId,
          name: normalizedName
        });

        return cloneValue(stateRecord.value);
      } catch (error) {
        void Promise.resolve().then(() => this.healthReporter?.({
          pluginId,
          source: 'state',
          stateName: normalizedName,
          error
        }));
        throw error;
      }
    };

    this.updateQueue = this.updateQueue.then(executeUpdate);
    return this.updateQueue;
  }

  subscribe(pluginId: string, name: string, handler: (value: unknown, metadata: { name: string, owner: string, previousValue: unknown }) => void | Promise<void>) {
    const normalizedName = normalizeStateName(name);
    if (typeof handler !== 'function') {
      throw new Error(`state subscriber for ${pluginId}:${normalizedName} must be a function`);
    }

    const stateRecord = this.getOwnedState(pluginId, normalizedName);
    const subscription = {
      id: ++this.subscriptionSequence,
      pluginId,
      active: true,
      handler
    };

    stateRecord.subscribers.set(subscription.id, subscription);
    if (!this.subscribersByPlugin.has(pluginId)) {
      this.subscribersByPlugin.set(pluginId, new Set());
    }

    this.subscribersByPlugin.get(pluginId).add(subscription);

    return () => {
      if (!subscription.active) {
        return;
      }

      subscription.active = false;
      stateRecord.subscribers.delete(subscription.id);
      this.subscribersByPlugin.get(pluginId)?.delete(subscription);
    };
  }

  unloadPlugin(pluginId: string) {
    for (const [key, stateRecord] of this.stateByKey.entries()) {
      if (stateRecord.owner !== pluginId) {
        continue;
      }

      for (const subscription of stateRecord.subscribers.values()) {
        subscription.active = false;
      }

      stateRecord.subscribers.clear();
      this.stateByKey.delete(key);
    }

    this.subscribersByPlugin.delete(pluginId);

    void this.eventSystem?.emitInternal?.('plugin.runtime.state.unloaded', {
      owner: pluginId
    });
  }

  createStateKey(pluginId: string, name: string) {
    return `${pluginId}:${name}`;
  }

  getOwnedState(pluginId: string, name: string) {
    const normalizedName = normalizeStateName(name);
    const key = this.createStateKey(pluginId, normalizedName);
    const stateRecord = this.stateByKey.get(key);
    if (!stateRecord) {
      throw new Error(`state "${normalizedName}" is not defined for plugin ${pluginId}`);
    }

    if (stateRecord.owner !== pluginId) {
      throw new Error(`plugin ${pluginId} cannot access state "${normalizedName}" owned by ${stateRecord.owner}`);
    }

    return stateRecord;
  }
}
