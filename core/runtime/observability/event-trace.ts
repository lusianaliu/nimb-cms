const clonePayload = (payload: unknown) => structuredClone(payload);

export class EventTrace {
  constructor(options: { diagnosticsChannel?: { emit: (eventType: string, payload: unknown) => void } } = {}) {
    this.entries = [];
    this.logicalTimestamp = 0;
    this.diagnosticsChannel = options.diagnosticsChannel;
  }

  recordEmission(eventName: string, emitterPlugin: string, subscriberPlugins: string[]) {
    const entry = Object.freeze({
      timestamp: ++this.logicalTimestamp,
      eventName,
      emitterPlugin,
      subscriberPlugins: Object.freeze([...subscriberPlugins])
    });

    this.entries.push(entry);
    this.diagnosticsChannel?.emit('plugin.runtime.diagnostics.event-trace.recorded', {
      timestamp: entry.timestamp,
      eventName,
      emitterPlugin,
      subscriberCount: subscriberPlugins.length
    });

    return entry;
  }

  snapshot() {
    return this.entries.map((entry) => Object.freeze({
      timestamp: entry.timestamp,
      eventName: entry.eventName,
      emitterPlugin: entry.emitterPlugin,
      subscriberPlugins: Object.freeze([...entry.subscriberPlugins])
    }));
  }
}
