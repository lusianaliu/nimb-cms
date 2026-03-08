import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseAdapter, DatabaseRecord, QueryOptions } from './adapter.ts';

type Runtime = {
  contentTypes?: {
    get: (name: string) => { fields?: Array<{ name: string; type: string; required?: boolean }> } | undefined;
  };
  fieldTypes?: {
    get: (name: string) => {
      validate: (value: unknown) => boolean;
      serialize: (value: unknown) => unknown;
      deserialize: (value: unknown) => unknown;
    } | undefined;
  };
  projectPaths?: {
    dataDir?: string;
  };
};

const readJson = <T>(filePath: string, fallback: T): T => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

const writeJson = (filePath: string, value: unknown): void => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const assertTypeRegistered = (runtime: Runtime, type: string) => {
  const schema = runtime.contentTypes?.get(type);

  if (!schema) {
    throw new Error(`Unknown content type: ${type}`);
  }

  return schema;
};

const createFieldValidator = (runtime: Runtime) => {
  return (type: string, data: Record<string, unknown>, options: { partial?: boolean } = {}) => {
    const schema = assertTypeRegistered(runtime, type);
    const fields = schema.fields ?? [];
    const fieldNames = new Set(fields.map((field) => field.name));

    for (const key of Object.keys(data)) {
      if (!fieldNames.has(key)) {
        throw new Error(`Unknown field for content type "${type}": ${key}`);
      }
    }

    for (const field of fields) {
      const fieldType = runtime.fieldTypes?.get(field.type);
      if (!fieldType) {
        throw new Error(`Unknown field type "${field.type}" for content type "${type}"`);
      }

      const value = data[field.name];
      const hasValue = value !== undefined;

      if (!hasValue) {
        if (!options.partial && field.required) {
          throw new Error(`Missing required field "${field.name}" for content type "${type}"`);
        }
        continue;
      }

      if (!fieldType.validate(value)) {
        throw new Error(`Invalid value for field "${field.name}" on content type "${type}"`);
      }
    }
  };
};

const createFieldSerializer = (runtime: Runtime) => {
  return (type: string, data: Record<string, unknown>) => {
    const schema = assertTypeRegistered(runtime, type);
    const serialized: Record<string, unknown> = {};

    for (const field of schema.fields ?? []) {
      const fieldType = runtime.fieldTypes?.get(field.type);
      if (!fieldType) {
        throw new Error(`Unknown field type "${field.type}" for content type "${type}"`);
      }

      if (data[field.name] !== undefined) {
        serialized[field.name] = fieldType.serialize(data[field.name]);
      }
    }

    return serialized;
  };
};

const createFieldDeserializer = (runtime: Runtime) => {
  return (type: string, data: Record<string, unknown>) => {
    const schema = assertTypeRegistered(runtime, type);
    const deserialized: Record<string, unknown> = {};

    for (const field of schema.fields ?? []) {
      const fieldType = runtime.fieldTypes?.get(field.type);
      if (!fieldType) {
        throw new Error(`Unknown field type "${field.type}" for content type "${type}"`);
      }

      if (data[field.name] !== undefined) {
        deserialized[field.name] = fieldType.deserialize(data[field.name]);
      }
    }

    return deserialized;
  };
};

export const createFileAdapter = (runtime: Runtime): DatabaseAdapter => {
  const baseDir = path.join(runtime.projectPaths?.dataDir ?? path.resolve('data'), 'content');
  const validateFields = createFieldValidator(runtime);
  const serializeFields = createFieldSerializer(runtime);
  const deserializeFields = createFieldDeserializer(runtime);

  const typeDir = (type: string) => path.join(baseDir, type);
  const entryPath = (type: string, id: string) => path.join(typeDir(type), `${id}.json`);
  const indexPath = (type: string) => path.join(typeDir(type), 'index.json');

  const ensureTypeDir = (type: string) => {
    fs.mkdirSync(typeDir(type), { recursive: true });
  };

  const nextId = (type: string): string => {
    ensureTypeDir(type);
    const index = readJson<{ lastId: number }>(indexPath(type), { lastId: 0 });
    const lastId = Number.isInteger(index.lastId) ? index.lastId : 0;
    const currentId = lastId + 1;
    writeJson(indexPath(type), { lastId: currentId });
    return String(currentId);
  };

  const readEntry = (type: string, id: string): DatabaseRecord | undefined => {
    const filePath = entryPath(type, id);

    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    return readJson<DatabaseRecord>(filePath, undefined as never);
  };

  const hydrateEntry = (type: string, entry: DatabaseRecord): DatabaseRecord => ({
    ...entry,
    data: deserializeFields(type, entry.data)
  });

  const persistEntry = (entry: DatabaseRecord): DatabaseRecord => {
    ensureTypeDir(entry.type);
    writeJson(entryPath(entry.type, entry.id), entry);

    return hydrateEntry(entry.type, entry);
  };

  const normalizeSort = (sort?: string): { field: string; direction: 'asc' | 'desc' } => {
    if (!sort) {
      return { field: 'id', direction: 'asc' };
    }

    const normalized = `${sort}`.trim();
    const delimiter = normalized.includes(':') ? ':' : ' ';
    const [rawField, rawDirection] = normalized.split(delimiter);
    const field = rawField?.trim() || 'id';
    const direction = rawDirection?.trim().toLowerCase() === 'desc' ? 'desc' : 'asc';

    return { field, direction };
  };

  const compareValues = (left: unknown, right: unknown): number => {
    if (left === right) {
      return 0;
    }

    if (left === undefined) {
      return -1;
    }

    if (right === undefined) {
      return 1;
    }

    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }

    return String(left).localeCompare(String(right));
  };

  const entrySortValue = (entry: DatabaseRecord, field: string): unknown => {
    if (field in entry) {
      return entry[field as keyof DatabaseRecord];
    }

    return entry.data[field];
  };

  return Object.freeze({
    create: (type: string, data: Record<string, unknown>) => {
      assertTypeRegistered(runtime, type);
      validateFields(type, data);

      const now = new Date().toISOString();
      const entry: DatabaseRecord = {
        id: nextId(type),
        type,
        data: serializeFields(type, data),
        createdAt: now,
        updatedAt: now
      };

      return persistEntry(entry);
    },
    get: (type: string, id: string) => {
      assertTypeRegistered(runtime, type);
      const existing = readEntry(type, id);

      if (!existing) {
        return undefined;
      }

      return hydrateEntry(type, existing);
    },
    update: (type: string, id: string, data: Record<string, unknown>) => {
      assertTypeRegistered(runtime, type);
      const existing = readEntry(type, id);

      if (!existing) {
        throw new Error(`Entry not found: ${type}/${id}`);
      }

      const merged = {
        ...deserializeFields(type, existing.data),
        ...data
      };

      validateFields(type, merged);

      return persistEntry({
        ...existing,
        data: serializeFields(type, merged),
        updatedAt: new Date().toISOString()
      });
    },
    delete: (type: string, id: string) => {
      assertTypeRegistered(runtime, type);
      const filePath = entryPath(type, id);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Entry not found: ${type}/${id}`);
      }

      fs.unlinkSync(filePath);
    },
    query: (type: string, options: QueryOptions = {}) => {
      assertTypeRegistered(runtime, type);
      ensureTypeDir(type);

      const files = fs.readdirSync(typeDir(type))
        .filter((fileName) => fileName.endsWith('.json') && fileName !== 'index.json');

      const { field, direction } = normalizeSort(options.sort);
      const offset = Number.isInteger(options.offset) && (options.offset as number) > 0 ? (options.offset as number) : 0;
      const hasLimit = Number.isInteger(options.limit) && (options.limit as number) >= 0;
      const limit = hasLimit ? (options.limit as number) : undefined;

      const entries = files
        .map((fileName) => readEntry(type, fileName.slice(0, -'.json'.length)))
        .filter((entry): entry is DatabaseRecord => Boolean(entry))
        .sort((left, right) => {
          const compared = compareValues(entrySortValue(left, field), entrySortValue(right, field));
          if (compared !== 0) {
            return direction === 'desc' ? -compared : compared;
          }

          return Number(left.id) - Number(right.id);
        })
        .slice(offset, limit === undefined ? undefined : offset + limit)
        .map((entry) => hydrateEntry(type, entry));

      return entries;
    }
  });
};
