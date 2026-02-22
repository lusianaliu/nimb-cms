export class CapabilityTrace {
  constructor(options: { diagnosticsChannel?: { emit: (eventType: string, payload: unknown) => void } } = {}) {
    this.entries = [];
    this.sequence = 0;
    this.diagnosticsChannel = options.diagnosticsChannel;
  }

  recordResolution(capabilityId: string, providerPlugin: string, consumerPlugin: string) {
    const entry = Object.freeze({
      sequence: ++this.sequence,
      capabilityId,
      providerPlugin,
      consumerPlugin,
      result: 'resolved'
    });

    this.entries.push(entry);
    this.diagnosticsChannel?.emit('plugin.runtime.diagnostics.capability-trace.resolved', entry);
    return entry;
  }

  recordInvocation(capabilityId: string, providerPlugin: string, consumerPlugin: string, success: boolean) {
    const entry = Object.freeze({
      sequence: ++this.sequence,
      capabilityId,
      providerPlugin,
      consumerPlugin,
      result: success ? 'success' : 'failure'
    });

    this.entries.push(entry);
    this.diagnosticsChannel?.emit('plugin.runtime.diagnostics.capability-trace.invoked', entry);
    return entry;
  }

  snapshot() {
    return this.entries.map((entry) => Object.freeze({ ...entry }));
  }
}
