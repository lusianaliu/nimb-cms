const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
    return keys.reduce((accumulator, key) => {
      accumulator[key] = canonicalize(value[key]);
      return accumulator;
    }, {});
  }

  return value;
};

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return value;
};

const deterministicHash = (value) => {
  const text = JSON.stringify(canonicalize(value));
  let hash = 5381;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return `runtime-state-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export class RuntimeStateSnapshot {
  static empty({ createdAt = '1970-01-01T00:00:00.000Z', state } = {}) {
    return RuntimeStateSnapshot.from({
      createdAt,
      state: state ?? {
        timestamp: createdAt,
        topologySnapshot: { nodes: [], edges: [], activationOrder: [], unresolvedDependencies: [] },
        healthSnapshot: { plugins: [], failures: [], recoveryActions: [], degradedCapabilities: [] },
        policySnapshot: { evaluations: [] },
        schedulerSnapshot: { queue: [], executed: [], skipped: [], plans: [] },
        reconcilerSnapshot: { cycle: 0, stable: true, drift: [], actions: [] },
        derivedStatus: { systemHealthy: true, degraded: false, pendingCorrections: 0, activePlugins: 0 }
      }
    });
  }

  static from({ createdAt, state, snapshotId } = {}) {
    const normalizedState = canonicalize(state ?? {});

    const snapshot = {
      version: 'v1',
      snapshotId: snapshotId ?? deterministicHash(normalizedState),
      createdAt,
      state: normalizedState
    };

    return deepFreeze(snapshot);
  }
}
