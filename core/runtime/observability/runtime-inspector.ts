import { RuntimeStateSnapshot } from '../state/state-snapshot.ts';
const freezeEntries = (entries: unknown[]) => Object.freeze(entries.map((entry) => Object.freeze(entry)));

export class RuntimeInspector {
  constructor(options: {
    registry?: { list: () => unknown[] },
    eventTrace?: { snapshot: () => unknown[] },
    capabilityTrace?: { snapshot: () => unknown[] },
    stateTrace?: { snapshot: () => unknown[] },
    diagnosticsChannel?: { snapshot: () => unknown[] },
    topologyProvider?: () => unknown,
    healthProvider?: () => unknown,
    versionProvider?: () => unknown,
    routingProvider?: () => unknown,
    sandboxProvider?: () => unknown,
    policyProvider?: () => unknown,
    schedulerProvider?: () => unknown,
    reconcilerProvider?: () => unknown,
    stateProvider?: () => unknown
  } = {}) {
    this.registry = options.registry;
    this.eventTrace = options.eventTrace;
    this.capabilityTrace = options.capabilityTrace;
    this.stateTrace = options.stateTrace;
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.topologyProvider = options.topologyProvider;
    this.healthProvider = options.healthProvider;
    this.versionProvider = options.versionProvider;
    this.routingProvider = options.routingProvider;
    this.sandboxProvider = options.sandboxProvider;
    this.policyProvider = options.policyProvider;
    this.schedulerProvider = options.schedulerProvider;
    this.reconcilerProvider = options.reconcilerProvider;
    this.stateProvider = options.stateProvider;
  }

  health() {
    return this.healthProvider?.() ?? Object.freeze({
      plugins: Object.freeze([]),
      failures: Object.freeze([]),
      recoveryActions: Object.freeze([]),
      degradedCapabilities: Object.freeze([])
    });
  }

  topology() {
    return this.topologyProvider?.() ?? Object.freeze({
      nodes: Object.freeze([]),
      edges: Object.freeze([]),
      activationOrder: Object.freeze([]),
      unresolvedDependencies: Object.freeze([])
    });
  }

  versions() {
    return this.versionProvider?.() ?? Object.freeze({
      resolvedVersions: Object.freeze([]),
      compatibilityWarnings: Object.freeze([]),
      rejectedPlugins: Object.freeze([])
    });
  }

  routing() {
    return this.routingProvider?.() ?? Object.freeze({
      decisions: Object.freeze([])
    });
  }

  sandbox() {
    return this.sandboxProvider?.() ?? Object.freeze({
      executions: Object.freeze([])
    });
  }

  policy() {
    return this.policyProvider?.() ?? Object.freeze({
      evaluations: Object.freeze([])
    });
  }

  scheduler() {
    return this.schedulerProvider?.() ?? Object.freeze({
      queue: Object.freeze([]),
      executed: Object.freeze([]),
      skipped: Object.freeze([]),
      plans: Object.freeze([])
    });
  }

  reconciler() {
    return this.reconcilerProvider?.() ?? Object.freeze({
      cycle: 0,
      stable: true,
      drift: Object.freeze([]),
      actions: Object.freeze([])
    });
  }


  state() {
    return this.stateProvider?.() ?? RuntimeStateSnapshot.empty();
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
