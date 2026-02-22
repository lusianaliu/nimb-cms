import { createEntry } from './entry-schema.ts';
import { validateEntryData } from './entry-validator.ts';

const mutationAllowed = (source) => source === 'admin.command' || source === 'restore';

const byCreatedAt = (left, right) => {
  const byTime = left.createdAt.localeCompare(right.createdAt);
  if (byTime !== 0) {
    return byTime;
  }

  return left.id.localeCompare(right.id);
};

export class EntryRegistry {
  constructor({ contentRegistry }) {
    if (!contentRegistry) {
      throw new Error('EntryRegistry requires contentRegistry');
    }

    this.contentRegistry = contentRegistry;
    this.entriesByType = new Map();
    this.entriesById = new Map();
  }

  create(type, data, { source = 'unknown', timestamp = new Date().toISOString(), updatedAt = timestamp } = {}) {
    if (!mutationAllowed(source)) {
      throw new Error('Entry mutations require admin command');
    }

    const schema = this.contentRegistry.get(type);
    if (!schema) {
      throw new Error(`Content type not found: ${type}`);
    }

    const validation = validateEntryData({ schema, input: data });
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    const id = createEntry({ type, data: validation.data, createdAt: timestamp, updatedAt }).id;
    const existing = this.entriesById.get(id);
    if (existing) {
      const updated = createEntry({ type, data: validation.data, createdAt: existing.createdAt, updatedAt });
      this.entriesById.set(updated.id, updated);
      this.#index(updated);
      return updated;
    }

    const created = createEntry({ type, data: validation.data, createdAt: timestamp, updatedAt });
    this.entriesById.set(created.id, created);
    this.#index(created);
    return created;
  }

  list(type) {
    if (!this.contentRegistry.get(type)) {
      return Object.freeze([]);
    }

    return Object.freeze([...(this.entriesByType.get(type) ?? [])].sort(byCreatedAt));
  }

  get(type, id) {
    const entry = this.entriesById.get(id);
    if (!entry || entry.type !== type) {
      return null;
    }

    return entry;
  }

  restore(entries = []) {
    for (const entry of entries) {
      this.create(entry.type, entry.data, { source: 'restore', timestamp: entry.createdAt, updatedAt: entry.updatedAt ?? entry.createdAt });
    }
  }

  snapshot() {
    const all = [...this.entriesById.values()].sort((left, right) => left.id.localeCompare(right.id));
    return Object.freeze({
      schemaVersion: 'v1',
      entries: Object.freeze(all)
    });
  }

  inspectorSnapshot() {
    const types = this.contentRegistry.list().map((schema) => schema.name);
    return Object.freeze(types.map((type) => Object.freeze({ type, count: this.list(type).length })));
  }

  #index(entry) {
    const current = this.entriesByType.get(entry.type) ?? [];
    const next = current.filter((item) => item.id !== entry.id);
    next.push(entry);
    this.entriesByType.set(entry.type, Object.freeze(next.sort(byCreatedAt)));
  }
}
