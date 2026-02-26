import type { ContentEntry } from './content-entry.ts';
import { ContentStore } from './content-store.ts';

type PersistSnapshot = () => Promise<void>;

export class ContentCommandService {
  readonly #contentStore: ContentStore;
  readonly #persistSnapshot: PersistSnapshot;

  constructor(contentStore: ContentStore, persistSnapshot: PersistSnapshot) {
    this.#contentStore = contentStore;
    this.#persistSnapshot = persistSnapshot;
  }

  async create(typeSlug: string, data: Record<string, unknown>): Promise<ContentEntry> {
    const entry = this.#contentStore.create(typeSlug, data);
    await this.#persistSnapshot();
    return entry;
  }

  async update(typeSlug: string, id: string, data: Record<string, unknown>): Promise<ContentEntry> {
    const entry = this.#contentStore.update(typeSlug, id, data);
    await this.#persistSnapshot();
    return entry;
  }

  async delete(typeSlug: string, id: string): Promise<void> {
    this.#contentStore.delete(typeSlug, id);
    await this.#persistSnapshot();
  }
}
