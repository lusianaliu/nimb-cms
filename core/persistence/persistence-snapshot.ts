const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).sort((left, right) => left.localeCompare(right)).reduce((accumulator, key) => {
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

export const deterministicJson = (value) => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

export class PersistenceSnapshot {
  static empty({ restoredAt = null } = {}) {
    return PersistenceSnapshot.from({
      schemaVersion: 'v1',
      restoredAt,
      runtime: null,
      goals: null,
      orchestrator: null
    });
  }

  static from({ schemaVersion = 'v1', restoredAt = null, runtime = null, goals = null, orchestrator = null } = {}) {
    return deepFreeze(canonicalize({
      schemaVersion,
      restoredAt,
      runtime,
      goals,
      orchestrator
    }));
  }
}
