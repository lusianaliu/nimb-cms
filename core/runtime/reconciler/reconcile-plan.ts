const freezeEntries = (entries = []) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

const actionOrder = Object.freeze({
  'remove-topology-node': 0,
  'restart-plugin': 1,
  'schedule-plugin': 2
});

const compareActions = (left, right) => {
  if (left.pluginId !== right.pluginId) {
    return left.pluginId.localeCompare(right.pluginId);
  }

  const leftOrder = actionOrder[left.type] ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = actionOrder[right.type] ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return JSON.stringify(left).localeCompare(JSON.stringify(right));
};

export class ReconcilePlan {
  static from({ cycle = 0, drift = [], actions = [] } = {}) {
    const normalizedDrift = [...(drift ?? [])].map((entry) => ({ ...entry })).sort((left, right) => {
      if (left.pluginId !== right.pluginId) {
        return left.pluginId.localeCompare(right.pluginId);
      }

      return left.reason.localeCompare(right.reason);
    });

    const orderedActions = [...(actions ?? [])].map((entry) => ({ ...entry })).sort(compareActions);

    return Object.freeze({
      cycle,
      drift: freezeEntries(normalizedDrift),
      actions: freezeEntries(orderedActions)
    });
  }
}
