const freezeEntries = (entries: unknown[]) => Object.freeze(entries.map((entry) => Object.freeze(entry)));

export class RuntimeInspector {
  constructor(options: {
    registry?: { list: () => unknown[] },
    eventTrace?: { snapshot: () => unknown[] },
    capabilityTrace?: { snapshot: () => unknown[] },
    stateTrace?: { snapshot: () => unknown[] },
    diagnosticsChannel?: { snapshot: () => unknown[] },
    topologyProvider?: () => unknown
  } = {}) {
    this.registry = options.registry;
    this.eventTrace = options.eventTrace;
    this.capabilityTrace = options.capabilityTrace;
    this.stateTrace = options.stateTrace;
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.topologyProvider = options.topologyProvider;
  }

  topology() {
    return this.topologyProvider?.() ?? Object.freeze({
      nodes: Object.freeze([]),
      edges: Object.freeze([]),
      activationOrder: Object.freeze([]),
      unresolvedDependencies: Object.freeze([])
    });
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
