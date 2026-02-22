const STORAGE_KEY = 'content-entries';

const byTypeAndId = (left, right) => {
  const byType = String(left?.type ?? '').localeCompare(String(right?.type ?? ''));
  if (byType !== 0) {
    return byType;
  }

  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
};

const normalizeSnapshot = (snapshot) => {
  const entries = Array.isArray(snapshot?.entries)
    ? [...snapshot.entries].sort(byTypeAndId)
    : [];

  return Object.freeze({
    schemaVersion: String(snapshot?.schemaVersion ?? 'v1'),
    entries: Object.freeze(entries)
  });
};

export class EntryStore {
  constructor({ storageAdapter } = {}) {
    if (!storageAdapter) {
      throw new Error('EntryStore requires storageAdapter');
    }

    this.storageAdapter = storageAdapter;
    this.lastPersisted = null;
  }

  async persist(snapshot) {
    const normalized = normalizeSnapshot(snapshot);
    const serialized = JSON.stringify(normalized);

    if (serialized === this.lastPersisted) {
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
