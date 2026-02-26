export type EventHandler<TPayload> = (payload: TPayload) => void;

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
      const eventListeners = this.#listeners.get(eventName);
      if (!eventListeners) {
        return;
      }

      eventListeners.delete(handler as EventHandler<TEvents[keyof TEvents]>);
      if (eventListeners.size === 0) {
        this.#listeners.delete(eventName);
      }
    };
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
