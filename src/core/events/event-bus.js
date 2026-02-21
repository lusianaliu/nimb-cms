export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName).add(listener);
    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) {
      return;
    }

    eventListeners.delete(listener);
    if (eventListeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  emit(eventName, payload) {
    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) {
      return;
    }

    for (const listener of eventListeners) {
      listener(payload);
    }
  }
}
