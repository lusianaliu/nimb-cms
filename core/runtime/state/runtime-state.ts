const sortByPluginId = (entries = []) => [...entries].sort((left, right) => {
  const leftId = String(left?.pluginId ?? '');
  const rightId = String(right?.pluginId ?? '');
  const byPlugin = leftId.localeCompare(rightId);
  if (byPlugin !== 0) {
    return byPlugin;
  }

  return JSON.stringify(left).localeCompare(JSON.stringify(right));
});

const normalizeArray = (entries = [], sort = true) => {
  const cloned = entries.map((entry) => ({ ...entry }));
  return Object.freeze(sort ? sortByPluginId(cloned) : cloned);
};

const toBoolean = (value) => value === true;

const countNonHealthyPlugins = (healthSnapshot) => (healthSnapshot.plugins ?? []).filter((plugin) => {
  const status = String(plugin?.status ?? 'unknown');
  return status !== 'healthy';
}).length;

const countPendingCorrections = (schedulerSnapshot, reconcilerSnapshot) => {
  const scheduled = schedulerSnapshot.queue?.length ?? 0;
  const actions = reconcilerSnapshot.actions?.length ?? 0;
  return scheduled + actions;
};

const countActivePlugins = (topologySnapshot) => {
  const activationOrder = Array.isArray(topologySnapshot.activationOrder)
    ? topologySnapshot.activationOrder
    : [];
  return activationOrder.length;
};

const deriveStatus = ({ topologySnapshot, healthSnapshot, schedulerSnapshot, reconcilerSnapshot }) => {
  const invalidTopologyCount = topologySnapshot.unresolvedDependencies?.length ?? 0;
  const unhealthyPluginCount = countNonHealthyPlugins(healthSnapshot);
  const pendingCorrections = countPendingCorrections(schedulerSnapshot, reconcilerSnapshot);
  const unstable = !toBoolean(reconcilerSnapshot.stable);
  const degraded = unstable || invalidTopologyCount > 0 || unhealthyPluginCount > 0;

  return Object.freeze({
    systemHealthy: !degraded && pendingCorrections === 0,
    degraded,
    pendingCorrections,
    activePlugins: countActivePlugins(topologySnapshot)
  });
};

export class RuntimeState {
  static from({
    timestamp,
    topologySnapshot,
    healthSnapshot,
    policySnapshot,
    schedulerSnapshot,
    reconcilerSnapshot
  }) {
    const normalizedTopology = Object.freeze({
      nodes: normalizeArray(topologySnapshot?.nodes ?? []),
      edges: normalizeArray(topologySnapshot?.edges ?? []),
      activationOrder: Object.freeze([...(topologySnapshot?.activationOrder ?? [])]),
      unresolvedDependencies: normalizeArray(topologySnapshot?.unresolvedDependencies ?? [])
    });

    const normalizedHealth = Object.freeze({
      plugins: normalizeArray(healthSnapshot?.plugins ?? []),
      failures: normalizeArray(healthSnapshot?.failures ?? []),
      recoveryActions: normalizeArray(healthSnapshot?.recoveryActions ?? []),
      degradedCapabilities: normalizeArray(healthSnapshot?.degradedCapabilities ?? [])
    });

    const normalizedPolicy = Object.freeze({
      evaluations: normalizeArray(policySnapshot?.evaluations ?? [], false)
    });

    const normalizedScheduler = Object.freeze({
      queue: normalizeArray(schedulerSnapshot?.queue ?? []),
      executed: normalizeArray(schedulerSnapshot?.executed ?? []),
      skipped: normalizeArray(schedulerSnapshot?.skipped ?? []),
      plans: normalizeArray(schedulerSnapshot?.plans ?? [])
    });

    const normalizedReconciler = Object.freeze({
      cycle: Number(reconcilerSnapshot?.cycle ?? 0),
      stable: toBoolean(reconcilerSnapshot?.stable ?? true),
      drift: normalizeArray(reconcilerSnapshot?.drift ?? []),
      actions: normalizeArray(reconcilerSnapshot?.actions ?? [])
    });

    return Object.freeze({
      timestamp,
      topologySnapshot: normalizedTopology,
      healthSnapshot: normalizedHealth,
      policySnapshot: normalizedPolicy,
      schedulerSnapshot: normalizedScheduler,
      reconcilerSnapshot: normalizedReconciler,
      derivedStatus: deriveStatus({
        topologySnapshot: normalizedTopology,
        healthSnapshot: normalizedHealth,
        schedulerSnapshot: normalizedScheduler,
        reconcilerSnapshot: normalizedReconciler
      })
    });
  }
}
