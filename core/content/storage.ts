import fs from 'node:fs';
import path from 'node:path';

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

type StoredEntry = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export const createContentStorage = (runtime: Runtime) => {
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

  const readEntry = (type: string, id: string): StoredEntry | undefined => {
    const filePath = entryPath(type, id);

    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    return readJson<StoredEntry>(filePath, undefined as never);
  };

  const persistEntry = (entry: StoredEntry): StoredEntry => {
    ensureTypeDir(entry.type);
    writeJson(entryPath(entry.type, entry.id), entry);

    return {
      ...entry,
      data: deserializeFields(entry.type, entry.data)
    };
  };

  return Object.freeze({
    create: (type: string, data: Record<string, unknown>) => {
      assertTypeRegistered(runtime, type);
      validateFields(type, data);

      const now = new Date().toISOString();
      const entry: StoredEntry = {
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

      return {
        ...existing,
        data: deserializeFields(type, existing.data)
      };
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
    list: (type: string) => {
      assertTypeRegistered(runtime, type);
      ensureTypeDir(type);

      const files = fs.readdirSync(typeDir(type))
        .filter((fileName) => fileName.endsWith('.json') && fileName !== 'index.json');

      return files
        .map((fileName) => readEntry(type, fileName.slice(0, -'.json'.length)))
        .filter((entry): entry is StoredEntry => Boolean(entry))
        .map((entry) => ({
          ...entry,
          data: deserializeFields(type, entry.data)
        }))
        .sort((left, right) => Number(left.id) - Number(right.id));
    }
  });
};
