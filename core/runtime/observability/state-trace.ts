export class StateTrace {
  constructor(options: { diagnosticsChannel?: { emit: (eventType: string, payload: unknown) => void } } = {}) {
    this.entries = [];
    this.updateSequence = 0;
    this.diagnosticsChannel = options.diagnosticsChannel;
  }

  recordMutation(pluginOwner: string, stateKey: string) {
    const entry = Object.freeze({
      updateSequenceId: ++this.updateSequence,
      pluginOwner,
      stateKey
    });

    this.entries.push(entry);
    this.diagnosticsChannel?.emit('plugin.runtime.diagnostics.state-trace.recorded', entry);
    return entry;
  }

  snapshot() {
    return this.entries.map((entry) => Object.freeze({ ...entry }));
  }
}
