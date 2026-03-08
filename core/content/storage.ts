import { createDatabase, createStorageProxy } from '../db/index.ts';

export const createContentStorage = (runtime) => createStorageProxy(createDatabase(runtime));
