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

const ENTRY_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['published']),
  published: Object.freeze(['archived']),
  archived: Object.freeze(['draft'])
});

const canTransition = ({ from, to }) => (ENTRY_TRANSITIONS[from] ?? Object.freeze([])).includes(to);

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
      const updated = createEntry({ type, data: validation.data, state: existing.state, createdAt: existing.createdAt, updatedAt });
      this.entriesById.set(updated.id, updated);
      this.#index(updated);
      return updated;
    }

    const created = createEntry({ type, data: validation.data, state: 'draft', createdAt: timestamp, updatedAt });
    this.entriesById.set(created.id, created);
    this.#index(created);
    return created;
  }

  transition(type, id, state, { source = 'unknown', timestamp = new Date().toISOString() } = {}) {
    if (!mutationAllowed(source)) {
      throw new Error('Entry mutations require admin command');
    }

    const entry = this.get(type, id);
    if (!entry) {
      throw new Error(`Entry not found: ${type}/${id}`);
    }

    if (entry.state === state) {
      return entry;
    }

    if (!canTransition({ from: entry.state, to: state })) {
      throw new Error(`Invalid entry state transition: ${entry.state} -> ${state}`);
    }

    const next = createEntry({
      type: entry.type,
      data: entry.data,
      state,
      createdAt: entry.createdAt,
      updatedAt: timestamp
    });

    this.entriesById.set(next.id, next);
    this.#index(next);
    return next;
  }

  publish(type, id, options) {
    return this.transition(type, id, 'published', options);
  }

  archive(type, id, options) {
    return this.transition(type, id, 'archived', options);
  }

  draft(type, id, options) {
    return this.transition(type, id, 'draft', options);
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
      const restored = this.create(entry.type, entry.data, {
        source: 'restore',
        timestamp: entry.createdAt,
        updatedAt: entry.updatedAt ?? entry.createdAt
      });

      if (restored.state !== (entry.state ?? 'draft')) {
        this.transition(entry.type, restored.id, entry.state ?? 'draft', {
          source: 'restore',
          timestamp: entry.updatedAt ?? entry.createdAt
        });
      }
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

    return Object.freeze(types.map((type) => {
      const entries = this.list(type);
      const stateCounts = entries.reduce((accumulator, entry) => {
        accumulator[entry.state] = (accumulator[entry.state] ?? 0) + 1;
        return accumulator;
      }, { draft: 0, published: 0, archived: 0 });

      return Object.freeze({ type, count: entries.length, states: Object.freeze(stateCounts) });
    }));
  }

  #index(entry) {
    const current = this.entriesByType.get(entry.type) ?? [];
    const next = current.filter((item) => item.id !== entry.id);
    next.push(entry);
    this.entriesByType.set(entry.type, Object.freeze(next.sort(byCreatedAt)));
  }
}
