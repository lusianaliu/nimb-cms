import { orderedStorageKeys } from './storage.ts';
import { PersistenceSnapshot, deterministicJson } from './persistence-snapshot.ts';

const deterministicRuntimeSnapshot = (runtime) => {
  if (!runtime || typeof runtime !== 'object') {
    return runtime ?? null;
  }

  const state = runtime.state && typeof runtime.state === 'object'
    ? { ...runtime.state, timestamp: '1970-01-01T00:00:00.000Z' }
    : runtime.state;

  return {
    ...runtime,
    createdAt: '1970-01-01T00:00:00.000Z',
    snapshotId: 'runtime-state-v1-persisted',
    state
  };
};


export class PersistenceEngine {
  constructor({ storageAdapter, now = () => new Date().toISOString() } = {}) {
    if (!storageAdapter) {
      throw new Error('PersistenceEngine requires storageAdapter');
    }

    this.storageAdapter = storageAdapter;
    this.now = now;
    this.lastSaveTime = null;
    this.storedKeys = Object.freeze([]);
    this.storageHealth = 'idle';
    this.lastPersistedByKey = new Map();
  }

  async persist(snapshot) {
    const normalized = PersistenceSnapshot.from({
      ...snapshot,
      restoredAt: snapshot?.restoredAt ?? this.now()
    });
    const payloadByKey = new Map([
      ['runtime', { schemaVersion: normalized.schemaVersion, payload: deterministicRuntimeSnapshot(normalized.runtime) }],
      ['goals', { schemaVersion: normalized.schemaVersion, payload: normalized.goals }],
      ['orchestrator', { schemaVersion: normalized.schemaVersion, payload: normalized.orchestrator }]
    ]);

    for (const key of orderedStorageKeys()) {
      const payload = payloadByKey.get(key);
      const serialized = deterministicJson(payload);

      if (this.lastPersistedByKey.get(key) === serialized) {
        continue;
      }

      await this.storageAdapter.write(key, payload);
      this.lastPersistedByKey.set(key, serialized);
    }

    this.lastSaveTime = this.now();
    this.storedKeys = await this.storageAdapter.list('');
    this.storageHealth = 'ok';

    return this.status();
  }

  async restore() {
    const keys = await this.storageAdapter.list('');
    const data = new Map();

    for (const key of orderedStorageKeys()) {
      if (!keys.includes(key)) {
        continue;
      }

      data.set(key, await this.storageAdapter.read(key));
    }

    this.storedKeys = Object.freeze([...keys]);
    this.storageHealth = 'ok';

    const runtime = data.get('runtime')?.payload ?? null;
    const goals = data.get('goals')?.payload ?? null;
    const orchestrator = data.get('orchestrator')?.payload ?? null;
    const schemaVersion = data.get('runtime')?.schemaVersion ?? 'v1';

    return PersistenceSnapshot.from({
      schemaVersion,
      restoredAt: this.now(),
      runtime,
      goals,
      orchestrator
    });
  }

  status() {
    return Object.freeze({
      lastSaveTime: this.lastSaveTime,
      storedKeys: this.storedKeys,
      storageHealth: this.storageHealth
    });
  }
}
