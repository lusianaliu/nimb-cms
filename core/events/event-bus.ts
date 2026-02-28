export type EventHandler<TPayload> = (payload: TPayload) => void;
export type PluginEventContext = Readonly<{
  pluginId: string;
  timestamp: string;
}>;
export type PluginEventHandler<TPayload> = (payload: TPayload, context: PluginEventContext) => void | Promise<void>;

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

const assertValidEventName = (eventName: string) => {
  if (typeof eventName !== 'string' || !EVENT_NAME_PATTERN.test(eventName)) {
    throw new Error(`Invalid event name "${String(eventName)}". Expected dotted format "domain.action".`);
  }
};

export const createEventBus = () => {
  const listeners = new Map<string, Set<PluginEventHandler<unknown>>>();

  const off = (eventName: string, handler: PluginEventHandler<unknown>) => {
    assertValidEventName(eventName);

    const eventListeners = listeners.get(eventName);
    if (!eventListeners) {
      return;
    }

    eventListeners.delete(handler);
    if (eventListeners.size === 0) {
      listeners.delete(eventName);
    }
  };

  return Object.freeze({
    on(eventName: string, handler: PluginEventHandler<unknown>) {
      assertValidEventName(eventName);

      if (typeof handler !== 'function') {
        throw new Error(`Event handler for "${eventName}" must be a function.`);
      }

      const eventListeners = listeners.get(eventName) ?? new Set<PluginEventHandler<unknown>>();
      eventListeners.add(handler);
      listeners.set(eventName, eventListeners);

      return () => off(eventName, handler);
    },

    off,

    async emit(eventName: string, payload: unknown, context: { pluginId: string } = { pluginId: 'runtime.system' }) {
      assertValidEventName(eventName);

      if (typeof context?.pluginId !== 'string' || context.pluginId.trim().length === 0) {
        throw new Error('Event emit requires a non-empty pluginId context.');
      }

      const eventListeners = [...(listeners.get(eventName) ?? [])];
      const eventContext = Object.freeze({
        pluginId: context.pluginId,
        timestamp: new Date().toISOString()
      });

      await Promise.all(eventListeners.map((handler) => Promise.resolve(handler(payload, eventContext))));
    }
  });
};

type ListenerSet<TPayload> = Set<EventHandler<TPayload>>;

export class EventEmitter<TEvents extends Record<string, unknown>> {
  readonly #listeners: Map<keyof TEvents, ListenerSet<TEvents[keyof TEvents]>>;

  constructor() {
    this.#listeners = new Map();
  }

  on<TEventName extends keyof TEvents>(eventName: TEventName, handler: EventHandler<TEvents[TEventName]>): () => void {
    const listeners = this.#listeners.get(eventName) ?? new Set<EventHandler<TEvents[TEventName]>>();
    listeners.add(handler);
    this.#listeners.set(eventName, listeners as ListenerSet<TEvents[keyof TEvents]>);

    return () => {
      this.off(eventName, handler);
    };
  }

  off<TEventName extends keyof TEvents>(eventName: TEventName, handler: EventHandler<TEvents[TEventName]>): void {
    const eventListeners = this.#listeners.get(eventName);
    if (!eventListeners) {
      return;
    }

    eventListeners.delete(handler as EventHandler<TEvents[keyof TEvents]>);
    if (eventListeners.size === 0) {
      this.#listeners.delete(eventName);
    }
  }

  emit<TEventName extends keyof TEvents>(eventName: TEventName, payload: TEvents[TEventName]): void {
    const listeners = this.#listeners.get(eventName);
    if (!listeners) {
      return;
    }

    for (const handler of listeners) {
      handler(payload);
    }
  }
}
