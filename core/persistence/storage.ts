export const STORAGE_KEYS = Object.freeze({
  runtime: 'runtime',
  goals: 'goals',
  orchestrator: 'orchestrator'
});

export const orderedStorageKeys = () => Object.freeze(Object.values(STORAGE_KEYS).sort((left, right) => left.localeCompare(right)));
