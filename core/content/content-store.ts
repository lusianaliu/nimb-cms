const STORAGE_KEY = 'content-types';

const normalizeSnapshot = (snapshot) => {
  const types = Array.isArray(snapshot?.types)
    ? [...snapshot.types].sort((left, right) => String(left?.name ?? '').localeCompare(String(right?.name ?? '')))
    : [];

  return Object.freeze({
    schemaVersion: String(snapshot?.schemaVersion ?? 'v1'),
    types: Object.freeze(types)
  });
};

export class ContentStore {
  constructor({ storageAdapter } = {}) {
    if (!storageAdapter) {
      throw new Error('ContentStore requires storageAdapter');
    }

    this.storageAdapter = storageAdapter;
    this.lastPersisted = null;
  }

  async persist(snapshot) {
    const normalized = normalizeSnapshot(snapshot);
    const serialized = JSON.stringify(normalized);

    if (this.lastPersisted === serialized) {
      return normalized;
    }

    await this.storageAdapter.write(STORAGE_KEY, normalized);
    this.lastPersisted = serialized;
    return normalized;
  }

  async restore() {
    const payload = await this.storageAdapter.read(STORAGE_KEY);
    const normalized = normalizeSnapshot(payload ?? {});
    this.lastPersisted = JSON.stringify(normalized);
    return normalized;
  }
}
