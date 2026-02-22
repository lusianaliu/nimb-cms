import { createEntry } from './entry-schema.ts';
import { validateEntryData } from './entry-validator.ts';
import fs from 'node:fs';
import path from 'node:path';

const mutationAllowed = (source) => source === 'admin.command' || source === 'restore';

const byCreatedAt = (left, right) => {
  const byTime = left.createdAt.localeCompare(right.createdAt);
  if (byTime !== 0) {
    return byTime;
  }

  return left.id.localeCompare(right.id);
};

const byUpdatedAt = (left, right) => {
  const byTime = left.updatedAt.localeCompare(right.updatedAt);
  if (byTime !== 0) {
    return byTime;
  }

  const byCreated = left.createdAt.localeCompare(right.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }

  return left.id.localeCompare(right.id);
};

const byId = (left, right) => left.id.localeCompare(right.id);

const sortComparators = Object.freeze({
  createdAt: byCreatedAt,
  updatedAt: byUpdatedAt,
  id: byId
});

const normalizeSort = (sort) => (sort === 'updatedAt' || sort === 'id' ? sort : 'createdAt');
const normalizeOrder = (order) => (String(order ?? '').toLowerCase() === 'desc' ? 'desc' : 'asc');

const normalizePagination = ({ limit, offset }) => {
  const parsedLimit = Number.parseInt(String(limit ?? ''), 10);
  const parsedOffset = Number.parseInt(String(offset ?? ''), 10);

  return Object.freeze({
    limit: Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : null,
    offset: Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0
  });
};

const withOrder = (comparator, order) => (order === 'desc'
  ? (left, right) => comparator(right, left)
  : comparator);

const ENTRY_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['published']),
  published: Object.freeze(['archived']),
  archived: Object.freeze(['draft'])
});

const canTransition = ({ from, to }) => (ENTRY_TRANSITIONS[from] ?? Object.freeze([])).includes(to);

export class EntryRegistry {
  constructor({ contentRegistry, rootDirectory = process.cwd() }) {
    if (!contentRegistry) {
      throw new Error('EntryRegistry requires contentRegistry');
    }

    this.contentRegistry = contentRegistry;
    this.entriesByType = new Map();
    this.entriesById = new Map();
    this.queryCount = 0;
    this.lastQuery = null;
    this.entriesFilePath = path.join(rootDirectory, 'data', 'entries.json');

    this.#ensureStorageFile();
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
      this.#persist();
      return updated;
    }

    const created = createEntry({ type, data: validation.data, state: 'draft', createdAt: timestamp, updatedAt });
    this.entriesById.set(created.id, created);
    this.#index(created);
    this.#persist();
    return created;
  }

  update(type, id, data, { source = 'unknown', timestamp = new Date().toISOString() } = {}) {
    if (!mutationAllowed(source)) {
      throw new Error('Entry mutations require admin command');
    }

    const entry = this.get(type, id);
    if (!entry) {
      throw new Error(`Entry not found: ${type}/${id}`);
    }

    const schema = this.contentRegistry.get(type);
    if (!schema) {
      throw new Error(`Content type not found: ${type}`);
    }

    const validation = validateEntryData({ schema, input: data });
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    const updated = createEntry({
      type,
      data: validation.data,
      state: entry.state,
      createdAt: entry.createdAt,
      updatedAt: timestamp
    });

    this.entriesById.delete(entry.id);
    this.entriesById.set(updated.id, updated);
    this.#index(updated);
    this.#persist();
    return updated;
  }

  delete(type, id, { source = 'unknown' } = {}) {
    if (!mutationAllowed(source)) {
      throw new Error('Entry mutations require admin command');
    }

    const entry = this.get(type, id);
    if (!entry) {
      throw new Error(`Entry not found: ${type}/${id}`);
    }

    this.entriesById.delete(entry.id);
    const next = (this.entriesByType.get(type) ?? []).filter((candidate) => candidate.id !== entry.id);
    this.entriesByType.set(type, Object.freeze(next.sort(byCreatedAt)));
    this.#persist();
    return entry;
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
    this.#persist();
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
    return this.query(type);
  }

  query(type, options = {}) {
    if (!this.contentRegistry.get(type)) {
      return Object.freeze([]);
    }

    const state = typeof options.state === 'string' ? options.state : null;
    const sort = normalizeSort(options.sort);
    const order = normalizeOrder(options.order);
    const pagination = normalizePagination(options);
    const comparator = withOrder(sortComparators[sort] ?? byCreatedAt, order);

    const sorted = [...(this.entriesByType.get(type) ?? [])].sort(comparator);
    const filtered = state ? sorted.filter((entry) => entry.state === state) : sorted;
    const paged = pagination.limit === null
      ? filtered.slice(pagination.offset)
      : filtered.slice(pagination.offset, pagination.offset + pagination.limit);

    this.queryCount += 1;
    this.lastQuery = Object.freeze({
      type,
      state,
      sort,
      order,
      limit: pagination.limit,
      offset: pagination.offset,
      matchedCount: filtered.length,
      returnedCount: paged.length
    });

    return Object.freeze(paged);
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

  restoreFromDisk() {
    const payload = this.#readStorage();
    this.restore(payload.entries);
  }

  persist() {
    this.#persist();
    return this.snapshot();
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

  queryInspectorSnapshot() {
    return Object.freeze({
      totalQueries: this.queryCount,
      lastQuery: this.lastQuery
    });
  }

  #index(entry) {
    const current = this.entriesByType.get(entry.type) ?? [];
    const next = current.filter((item) => item.id !== entry.id);
    next.push(entry);
    this.entriesByType.set(entry.type, Object.freeze(next.sort(byCreatedAt)));
  }

  #ensureStorageFile() {
    fs.mkdirSync(path.dirname(this.entriesFilePath), { recursive: true });
    if (!fs.existsSync(this.entriesFilePath)) {
      const initial = JSON.stringify({ schemaVersion: 'v1', entries: [] }, null, 2);
      fs.writeFileSync(this.entriesFilePath, `${initial}\n`, 'utf8');
    }
  }

  #readStorage() {
    this.#ensureStorageFile();

    let parsed;
    try {
      const content = fs.readFileSync(this.entriesFilePath, 'utf8');
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid entry storage file at ${this.entriesFilePath}: ${error instanceof Error ? error.message : 'parse failed'}`);
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
      throw new Error(`Invalid entry storage file at ${this.entriesFilePath}: expected { schemaVersion, entries[] }`);
    }

    const entries = [...parsed.entries].sort(byId);
    return Object.freeze({
      schemaVersion: String(parsed.schemaVersion ?? 'v1'),
      entries: Object.freeze(entries)
    });
  }

  #persist() {
    this.#ensureStorageFile();
    const snapshot = this.snapshot();
    const normalized = {
      schemaVersion: snapshot.schemaVersion,
      entries: [...snapshot.entries].sort(byId)
    };
    const serialized = `${JSON.stringify(normalized, null, 2)}\n`;
    const tempPath = `${this.entriesFilePath}.tmp`;

    fs.writeFileSync(tempPath, serialized, 'utf8');
    fs.renameSync(tempPath, this.entriesFilePath);
  }
}
