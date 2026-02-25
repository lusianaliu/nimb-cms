import { createContentEntry, type ContentEntry, validateContentEntryData } from './content-entry.ts';
import { ContentTypeRegistry } from './content-type-registry.ts';

export class ContentStore {
  readonly #entriesByType: Map<string, Map<string, ContentEntry>>;
  private readonly registry: ContentTypeRegistry;

  constructor(registry: ContentTypeRegistry) {
    this.registry = registry;
    this.#entriesByType = new Map();
  }

  create(typeSlug: string, data: Record<string, unknown>): ContentEntry {
    this.ensureTypeExists(typeSlug);

    const entry = createContentEntry(this.registry, typeSlug, data);
    const typeEntries = this.#entriesByType.get(typeSlug) ?? new Map<string, ContentEntry>();

    typeEntries.set(entry.id, entry);
    this.#entriesByType.set(typeSlug, typeEntries);

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

    return existing;
  }

  delete(typeSlug: string, id: string): void {
    this.ensureTypeExists(typeSlug);

    const typeEntries = this.#entriesByType.get(typeSlug);
    const existed = typeEntries?.delete(id) ?? false;

    if (!existed) {
      throw new Error(`Entry not found: ${typeSlug}/${id}`);
    }
  }

  private ensureTypeExists(typeSlug: string): void {
    if (!this.registry.get(typeSlug)) {
      throw new Error(`Unknown content type: ${typeSlug}`);
    }
  }
}
