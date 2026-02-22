export const RuntimeGoalType = Object.freeze({
  ENSURE_PLUGIN_ACTIVE: 'ENSURE_PLUGIN_ACTIVE',
  ENSURE_PLUGIN_HEALTHY: 'ENSURE_PLUGIN_HEALTHY',
  ENSURE_CAPABILITY_AVAILABLE: 'ENSURE_CAPABILITY_AVAILABLE',
  ENSURE_RUNTIME_STABLE: 'ENSURE_RUNTIME_STABLE'
});

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce((accumulator, key) => {
        accumulator[key] = canonicalize(value[key]);
        return accumulator;
      }, {});
  }

  return value;
};

const normalizeRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return Object.freeze({});
  }

  return Object.freeze(canonicalize(value));
};

export class RuntimeGoal {
  static from(input = {}) {
    const goalId = String(input.goalId ?? '').trim();
    if (!goalId) {
      throw new Error('runtime goal requires deterministic goalId');
    }

    const type = String(input.type ?? '').trim();
    if (!Object.values(RuntimeGoalType).includes(type)) {
      throw new Error(`unsupported runtime goal type: ${type || '<empty>'}`);
    }

    return Object.freeze({
      goalId,
      type,
      target: normalizeRecord(input.target),
      desiredCondition: normalizeRecord(input.desiredCondition),
      evaluationStrategy: String(input.evaluationStrategy ?? 'strict').trim() || 'strict',
      metadata: normalizeRecord(input.metadata)
    });
  }
}
