import { RuntimeState } from './runtime-state.ts';
import { RuntimeStateSnapshot } from './state-snapshot.ts';

const readProvider = (provider, fallback) => {
  if (typeof provider !== 'function') {
    return fallback;
  }

  const value = provider();
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  return value;
};

export class StateProjector {
  constructor(options = {}) {
    this.providers = Object.freeze({
      topology: options.topologyProvider,
      health: options.healthProvider,
      policy: options.policyProvider,
      scheduler: options.schedulerProvider,
      reconciler: options.reconcilerProvider
    });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  project() {
    const createdAt = this.clock();

    const state = RuntimeState.from({
      timestamp: createdAt,
      topologySnapshot: readProvider(this.providers.topology, {
        nodes: [],
        edges: [],
        activationOrder: [],
        unresolvedDependencies: []
      }),
      healthSnapshot: readProvider(this.providers.health, {
        plugins: [],
        failures: [],
        recoveryActions: [],
        degradedCapabilities: []
      }),
      policySnapshot: readProvider(this.providers.policy, {
        evaluations: []
      }),
      schedulerSnapshot: readProvider(this.providers.scheduler, {
        queue: [],
        executed: [],
        skipped: [],
        plans: []
      }),
      reconcilerSnapshot: readProvider(this.providers.reconciler, {
        cycle: 0,
        stable: true,
        drift: [],
        actions: []
      })
    });

    return RuntimeStateSnapshot.from({
      createdAt,
      state
    });
  }
}
