import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createContentEntry, type ContentEntry, validateContentEntryData } from './content-entry.ts';
import { ContentTypeRegistry } from './content-type-registry.ts';

type PersistedEntry = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  status?: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
};

type FlatContentRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  [field: string]: unknown;
};


const persistedToEntry = (persisted: PersistedEntry): ContentEntry => ({
  id: persisted.id,
  type: persisted.type,
  data: { ...(persisted.data ?? {}) },
  status: persisted.status,
  createdAt: new Date(persisted.createdAt),
  updatedAt: new Date(persisted.updatedAt)
});

const normalizePersistedEntry = (raw: unknown, typeSlug: string): PersistedEntry | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : randomUUID();
  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString();
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : createdAt;

  const status = candidate.status === 'draft' || candidate.status === 'published' || candidate.status === 'archived'
    ? candidate.status
    : undefined;

  if (candidate.data && typeof candidate.data === 'object' && !Array.isArray(candidate.data)) {
    return {
      id,
      type: typeSlug,
      data: { ...(candidate.data as Record<string, unknown>) },
      status,
      createdAt,
      updatedAt
    };
  }

  const data = { ...candidate };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.type;
  delete data.status;

  return {
    id,
    type: typeSlug,
    data,
    status,
    createdAt,
    updatedAt
  };
};

const toFlatRecord = (entry: ContentEntry): FlatContentRecord => ({
  id: entry.id,
  ...(entry.data ?? {}),
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString()
});

export class ContentStore {
  readonly #entriesByType: Map<string, Map<string, ContentEntry>>;
  private readonly registry: ContentTypeRegistry;
  private readonly rootDirectory: string;

  constructor(registry: ContentTypeRegistry, options: { rootDirectory?: string } = {}) {
    this.registry = registry;
    this.#entriesByType = new Map();
    const defaultRootDirectory = path.join(os.tmpdir(), `nimb-content-store-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    this.rootDirectory = path.resolve(options.rootDirectory ?? defaultRootDirectory);
    this.loadFromDisk();
  }

  create(typeSlug: string, data: Record<string, unknown>): ContentEntry {
    this.ensureTypeExists(typeSlug);

    const entry = createContentEntry(this.registry, typeSlug, data);
    entry.status = entry.status ?? 'published';
    const typeEntries = this.#entriesByType.get(typeSlug) ?? new Map<string, ContentEntry>();

    typeEntries.set(entry.id, entry);
    this.#entriesByType.set(typeSlug, typeEntries);
    this.persistType(typeSlug);

    return entry;
  }

  get(typeSlug: string, id: string): ContentEntry | undefined {
    this.ensureTypeExists(typeSlug);
    return this.#entriesByType.get(typeSlug)?.get(id);
  }

  list(typeSlug: string): ContentEntry[] {
    this.ensureTypeExists(typeSlug);
    const typeEntries = this.#entriesByType.get(typeSlug);

    if (!typeEntries) {
      return [];
    }

    return [...typeEntries.values()];
  }

  update(typeSlug: string, id: string, data: Record<string, unknown>): ContentEntry {
    this.ensureTypeExists(typeSlug);

    const typeEntries = this.#entriesByType.get(typeSlug);
    const existing = typeEntries?.get(id);

    if (!existing) {
      throw new Error(`Entry not found: ${typeSlug}/${id}`);
    }

    validateContentEntryData(this.registry, typeSlug, data);

    existing.data = { ...data };
    existing.updatedAt = new Date();
    this.persistType(typeSlug);

    return existing;
  }

  delete(typeSlug: string, id: string): void {
    this.ensureTypeExists(typeSlug);

    const typeEntries = this.#entriesByType.get(typeSlug);
    const existed = typeEntries?.delete(id) ?? false;

    if (!existed) {
      throw new Error(`Entry not found: ${typeSlug}/${id}`);
    }

    this.persistType(typeSlug);
  }

  private loadFromDisk(): void {
    fs.mkdirSync(this.rootDirectory, { recursive: true });

    for (const definition of this.registry.list()) {
      const filePath = this.filePathForType(definition.slug);
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const rawContent = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(rawContent);
      if (!Array.isArray(parsed)) {
        continue;
      }

      const entries = new Map<string, ContentEntry>();

      for (const item of parsed) {
        const normalized = normalizePersistedEntry(item, definition.slug);
        if (!normalized) {
          continue;
        }

        try {
          validateContentEntryData(this.registry, definition.slug, normalized.data);
        } catch {
          continue;
        }

        const entry = persistedToEntry(normalized);
        entry.status = entry.status ?? 'published';
        entries.set(entry.id, entry);
      }

      this.#entriesByType.set(definition.slug, entries);
    }
  }

  private persistType(typeSlug: string): void {
    fs.mkdirSync(this.rootDirectory, { recursive: true });

    const typeEntries = this.#entriesByType.get(typeSlug);
    const output = typeEntries
      ? [...typeEntries.values()].map((entry) => toFlatRecord(entry))
      : [];

    fs.writeFileSync(this.filePathForType(typeSlug), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  }

  private filePathForType(typeSlug: string): string {
    return path.join(this.rootDirectory, `${typeSlug}.json`);
  }

  private ensureTypeExists(typeSlug: string): void {
    if (!this.registry.get(typeSlug)) {
      throw new Error(`Unknown content type: ${typeSlug}`);
    }
  }
}
