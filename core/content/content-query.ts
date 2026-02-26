import type { ContentEntry } from './content-entry.ts';
import { ContentStore } from './content-store.ts';

export type QueryOptions = {
  includeDrafts?: boolean
  limit?: number
  offset?: number
  sort?: {
    field: string
    direction: 'asc' | 'desc'
  }
};

const resolveComparableValue = (entry: ContentEntry, field: string): string | number | boolean => {
  const directValue = (entry as Record<string, unknown>)[field];
  const fieldValue = (entry.data ?? {})[field];
  const value = fieldValue ?? directValue;

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (value === null || typeof value === 'undefined') {
    return '';
  }

  return JSON.stringify(value);
};

const compareEntries = (left: ContentEntry, right: ContentEntry, sort: NonNullable<QueryOptions['sort']>): number => {
  const leftValue = resolveComparableValue(left, sort.field);
  const rightValue = resolveComparableValue(right, sort.field);

  if (leftValue === rightValue) {
    return left.id.localeCompare(right.id);
  }

  const baseComparison = leftValue > rightValue ? 1 : -1;
  return sort.direction === 'desc' ? -baseComparison : baseComparison;
};

export class ContentQueryService {
  readonly #contentStore: ContentStore;

  constructor(contentStore: ContentStore) {
    this.#contentStore = contentStore;
  }

  list(type: string, queryOptions: QueryOptions = {}): ContentEntry[] {
    const entries = this.#contentStore
      .list(type)
      .filter((entry) => queryOptions.includeDrafts === true || (entry.status ?? 'published') === 'published');

    if (queryOptions.sort) {
      entries.sort((left, right) => compareEntries(left, right, queryOptions.sort!));
    }

    const offset = Number.isInteger(queryOptions.offset) ? Math.max(0, queryOptions.offset ?? 0) : 0;
    const limit = Number.isInteger(queryOptions.limit) ? Math.max(0, queryOptions.limit ?? 0) : undefined;

    if (typeof limit === 'number') {
      return entries.slice(offset, offset + limit);
    }

    if (offset > 0) {
      return entries.slice(offset);
    }

    return entries;
  }

  get(type: string, id: string): ContentEntry | undefined {
    return this.#contentStore.get(type, id);
  }
}
