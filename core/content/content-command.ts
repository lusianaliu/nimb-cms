import type { EventEmitter } from '../events/event-bus.ts';
import type { ContentEntry } from './content-entry.ts';
import { CONTENT_CREATED_EVENT, CONTENT_DELETED_EVENT, CONTENT_UPDATED_EVENT, type ContentEvents } from './content-events.ts';
import { ContentStore } from './content-store.ts';

type PersistSnapshot = () => Promise<void>;

export class ContentCommandService {
  readonly #contentStore: ContentStore;
  readonly #persistSnapshot: PersistSnapshot;
  readonly #eventBus: EventEmitter<ContentEvents> | null;

  constructor(contentStore: ContentStore, persistSnapshot: PersistSnapshot, eventBus: EventEmitter<ContentEvents> | null = null) {
    this.#contentStore = contentStore;
    this.#persistSnapshot = persistSnapshot;
    this.#eventBus = eventBus;
  }

  async create(typeSlug: string, data: Record<string, unknown>): Promise<ContentEntry> {
    const entry = this.#contentStore.create(typeSlug, data);
    await this.#persistSnapshot();
    this.#eventBus?.emit(CONTENT_CREATED_EVENT, { type: typeSlug, entry });
    return entry;
  }

  async update(typeSlug: string, id: string, data: Record<string, unknown>): Promise<ContentEntry> {
    const entry = this.#contentStore.update(typeSlug, id, data);
    await this.#persistSnapshot();
    this.#eventBus?.emit(CONTENT_UPDATED_EVENT, { type: typeSlug, entry });
    return entry;
  }

  async delete(typeSlug: string, id: string): Promise<void> {
    const entry = this.#contentStore.get(typeSlug, id);
    this.#contentStore.delete(typeSlug, id);
    await this.#persistSnapshot();

    if (entry) {
      this.#eventBus?.emit(CONTENT_DELETED_EVENT, { type: typeSlug, entry });
    }
  }
}
