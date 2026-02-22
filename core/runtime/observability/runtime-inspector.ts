const freezeEntries = (entries: unknown[]) => Object.freeze(entries.map((entry) => Object.freeze(entry)));

export class RuntimeInspector {
  constructor(options: {
    registry?: { list: () => unknown[] },
    eventTrace?: { snapshot: () => unknown[] },
    capabilityTrace?: { snapshot: () => unknown[] },
    stateTrace?: { snapshot: () => unknown[] },
    diagnosticsChannel?: { snapshot: () => unknown[] }
  } = {}) {
    this.registry = options.registry;
    this.eventTrace = options.eventTrace;
    this.capabilityTrace = options.capabilityTrace;
    this.stateTrace = options.stateTrace;
    this.diagnosticsChannel = options.diagnosticsChannel;
  }

  snapshot() {
    return Object.freeze({
      plugins: freezeEntries(this.registry?.list?.() ?? []),
      eventTrace: freezeEntries(this.eventTrace?.snapshot?.() ?? []),
      capabilityTrace: freezeEntries(this.capabilityTrace?.snapshot?.() ?? []),
      stateTrace: freezeEntries(this.stateTrace?.snapshot?.() ?? []),
      diagnostics: freezeEntries(this.diagnosticsChannel?.snapshot?.() ?? [])
    });
  }
}
