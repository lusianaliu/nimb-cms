const clonePayload = (payload: unknown) => structuredClone(payload);

export class DiagnosticsChannel {
  constructor() {
    this.events = [];
    this.subscribers = new Map();
    this.sequence = 0;
    this.subscriptionSequence = 0;
  }

  emit(eventType: string, payload: unknown = {}) {
    if (typeof eventType !== 'string' || eventType.trim().length === 0) {
      throw new Error('diagnostic event type must be a non-empty string');
    }

    const event = Object.freeze({
      sequence: ++this.sequence,
      type: eventType,
      payload: clonePayload(payload)
    });

    this.events.push(event);

    const subscribers = [...this.subscribers.values()].sort((left, right) => left.id - right.id);
    for (const subscription of subscribers) {
      if (!subscription.active) {
        continue;
      }

      subscription.handler(event);
    }

    return event.sequence;
  }

  subscribe(handler: (event: { sequence: number, type: string, payload: unknown }) => void) {
    if (typeof handler !== 'function') {
      throw new Error('diagnostic subscriber must be a function');
    }

    const subscription = {
      id: ++this.subscriptionSequence,
      active: true,
      handler
    };

    this.subscribers.set(subscription.id, subscription);

    return () => {
      if (!subscription.active) {
        return;
      }

      subscription.active = false;
      this.subscribers.delete(subscription.id);
    };
  }

  snapshot() {
    return this.events.map((event) => Object.freeze({
      sequence: event.sequence,
      type: event.type,
      payload: clonePayload(event.payload)
    }));
  }
}
