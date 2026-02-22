import { RuntimeIntentType } from '../orchestrator/intent.ts';
import { RuntimeGoalType } from './goal.ts';

const sortById = (entries = [], key = 'goalId') => [...entries].sort((left, right) => String(left[key] ?? '').localeCompare(String(right[key] ?? '')));

const normalizeDecision = ({ goalId, satisfied, violated, requiredIntent = [] }) => Object.freeze({
  goalId,
  satisfied: Boolean(satisfied),
  violated: Boolean(violated),
  requiredIntent: Object.freeze(sortById(requiredIntent, 'intentId').map((entry) => Object.freeze({ ...entry })))
});

const hasDrift = (reconcilerSnapshot, pluginId, reason) => (reconcilerSnapshot?.drift ?? []).some((entry) => {
  if (reason && entry.reason !== reason) {
    return false;
  }

  return pluginId ? entry.pluginId === pluginId : true;
});

const isHealthy = (runtimeStateSnapshot, pluginId) => {
  const plugins = runtimeStateSnapshot?.state?.healthSnapshot?.plugins ?? [];
  return plugins.some((entry) => entry.pluginId === pluginId && entry.status === 'healthy');
};

const capabilityAvailable = (runtimeStateSnapshot, capability) => {
  const nodes = runtimeStateSnapshot?.state?.topologySnapshot?.nodes ?? [];
  return nodes.some((node) => (node.exportedCapabilities ?? []).includes(capability));
};

export class GoalEvaluator {
  evaluate(goal, snapshots = {}) {
    const runtimeStateSnapshot = snapshots.runtimeStateSnapshot;
    const reconcilerSnapshot = snapshots.reconcilerSnapshot;
    const schedulerSnapshot = snapshots.schedulerSnapshot;

    const pluginId = String(goal.target.pluginId ?? '').trim();
    const capability = String(goal.target.capability ?? '').trim();

    if (goal.type === RuntimeGoalType.ENSURE_PLUGIN_ACTIVE) {
      const activated = (schedulerSnapshot?.executed ?? []).some((entry) => entry.pluginId === pluginId && entry.status === 'success');
      const drifted = hasDrift(reconcilerSnapshot, pluginId, 'missing-activation') || hasDrift(reconcilerSnapshot, pluginId, 'plugin-unhealthy');
      const satisfied = activated && !drifted;

      return normalizeDecision({
        goalId: goal.goalId,
        satisfied,
        violated: !satisfied,
        requiredIntent: satisfied
          ? []
          : [{ intentId: `goal:${goal.goalId}:activate:${pluginId}`, type: RuntimeIntentType.ACTIVATE_PLUGIN, targetPlugins: [pluginId], metadata: { goalId: goal.goalId } }]
      });
    }

    if (goal.type === RuntimeGoalType.ENSURE_PLUGIN_HEALTHY) {
      const satisfied = Boolean(pluginId) && isHealthy(runtimeStateSnapshot, pluginId) && !hasDrift(reconcilerSnapshot, pluginId, 'plugin-unhealthy');
      return normalizeDecision({
        goalId: goal.goalId,
        satisfied,
        violated: !satisfied,
        requiredIntent: satisfied
          ? []
          : [{ intentId: `goal:${goal.goalId}:restart:${pluginId}`, type: RuntimeIntentType.RESTART_PLUGIN, targetPlugins: [pluginId], metadata: { goalId: goal.goalId } }]
      });
    }

    if (goal.type === RuntimeGoalType.ENSURE_CAPABILITY_AVAILABLE) {
      const satisfied = Boolean(capability) && capabilityAvailable(runtimeStateSnapshot, capability);
      return normalizeDecision({
        goalId: goal.goalId,
        satisfied,
        violated: !satisfied,
        requiredIntent: satisfied
          ? []
          : [{ intentId: `goal:${goal.goalId}:reconcile:${capability}`, type: RuntimeIntentType.RECONCILE_RUNTIME, targetPlugins: [], metadata: { goalId: goal.goalId, capability } }]
      });
    }

    const stable = reconcilerSnapshot?.stable === true
      && (reconcilerSnapshot?.drift?.length ?? 0) === 0
      && (reconcilerSnapshot?.actions?.length ?? 0) === 0;

    return normalizeDecision({
      goalId: goal.goalId,
      satisfied: stable,
      violated: !stable,
      requiredIntent: stable
        ? []
        : [{ intentId: `goal:${goal.goalId}:stabilize`, type: RuntimeIntentType.RECONCILE_RUNTIME, targetPlugins: [], metadata: { goalId: goal.goalId } }]
    });
  }

  evaluateAll(goals = [], snapshots = {}) {
    return Object.freeze(sortById(goals)
      .map((goal) => this.evaluate(goal, snapshots)));
  }
}
