import type { DatabaseAdapter, QueryOptions } from './adapter.ts';
import { createFileAdapter } from './file-adapter.ts';

type Runtime = {
  getConfig?: () => { database?: { adapter?: string } };
  db?: DatabaseAdapter;
};

const resolveAdapterName = (runtime: Runtime): string => {
  const configured = runtime.getConfig?.()?.database?.adapter;
  return typeof configured === 'string' && configured.trim() ? configured.trim().toLowerCase() : 'file';
};

export const createDatabase = (runtime: Runtime): DatabaseAdapter => {
  const adapterName = resolveAdapterName(runtime);

  if (adapterName !== 'file') {
    throw new Error(`Unsupported database adapter: ${adapterName}`);
  }

  return createFileAdapter(runtime);
};

export const createStorageProxy = (database: DatabaseAdapter) => {
  return Object.freeze({
    create: (type: string, data: Record<string, unknown>) => database.create(type, data),
    get: (type: string, id: string) => database.get(type, id),
    update: (type: string, id: string, data: Record<string, unknown>) => database.update(type, id, data),
    delete: (type: string, id: string) => database.delete(type, id),
    list: (type: string, options: QueryOptions = {}) => database.query(type, options),
    query: (type: string, options: QueryOptions = {}) => database.query(type, options)
  });
};

export type { DatabaseAdapter, QueryOptions } from './adapter.ts';
