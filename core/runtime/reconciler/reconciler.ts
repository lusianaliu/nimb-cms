import { ReconcilePlan } from './reconcile-plan.ts';
import { ReconcileSnapshot } from './reconcile-snapshot.ts';

const dedupe = (entries = []) => Object.freeze([...new Set(entries)].sort((left, right) => left.localeCompare(right)));

export class Reconciler {
  constructor(options = {}) {
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.topologyProvider = options.topologyProvider ?? (() => Object.freeze({ activationOrder: [], unresolvedDependencies: [] }));
    this.healthProvider = options.healthProvider ?? (() => Object.freeze({ plugins: [] }));
    this.schedulerProvider = options.schedulerProvider ?? (() => Object.freeze({ executed: [] }));
    this.policyProvider = options.policyProvider ?? (() => Object.freeze({ evaluations: [] }));
    this.cycle = 0;
    this.lastSnapshot = ReconcileSnapshot.from({ cycle: this.cycle, stable: true });
  }

  observe() {
    return Object.freeze({
      topology: this.topologyProvider(),
      health: this.healthProvider(),
      scheduler: this.schedulerProvider(),
      policy: this.policyProvider()
    });
  }

  detectDrift(inputs) {
    const activationOrder = inputs.topology.activationOrder ?? [];
    const successful = new Set((inputs.scheduler.executed ?? [])
      .filter((entry) => entry.status === 'success')
      .map((entry) => entry.pluginId));

    const invalidNodes = dedupe((inputs.topology.unresolvedDependencies ?? []).map((entry) => entry.pluginId));
    const failedPlugins = dedupe((inputs.health.plugins ?? [])
      .filter((entry) => entry.status && entry.status !== 'healthy')
      .map((entry) => entry.pluginId));
    const missingActivation = dedupe(activationOrder.filter((pluginId) => !successful.has(pluginId) && !invalidNodes.includes(pluginId)));

    const drift = [
      ...invalidNodes.map((pluginId) => ({ pluginId, reason: 'invalid-topology-node' })),
      ...failedPlugins.map((pluginId) => ({ pluginId, reason: 'plugin-unhealthy' })),
      ...missingActivation.map((pluginId) => ({ pluginId, reason: 'missing-activation' }))
    ];

    const actions = [
      ...invalidNodes.map((pluginId) => ({ type: 'remove-topology-node', pluginId })),
      ...failedPlugins.map((pluginId) => ({ type: 'restart-plugin', pluginId })),
      ...missingActivation.map((pluginId) => ({ type: 'schedule-plugin', pluginId }))
    ];

    return { drift, actions };
  }

  reconcile() {
    this.cycle += 1;
    const inputs = this.observe();
    const { drift, actions } = this.detectDrift(inputs);
    const plan = ReconcilePlan.from({ cycle: this.cycle, drift, actions });

    if (plan.drift.length > 0) {
      this.diagnosticsChannel?.emit('reconciler:drift-detected', {
        cycle: plan.cycle,
        drift: [...plan.drift]
      });
      this.diagnosticsChannel?.emit('reconciler:corrected', {
        cycle: plan.cycle,
        actions: [...plan.actions]
      });
    } else {
      this.diagnosticsChannel?.emit('reconciler:stable', { cycle: plan.cycle });
    }

    this.lastSnapshot = ReconcileSnapshot.from({
      cycle: this.cycle,
      stable: plan.actions.length === 0,
      drift: plan.drift,
      actions: plan.actions
    });

    return plan;
  }

  snapshot() {
    return this.lastSnapshot;
  }
}
