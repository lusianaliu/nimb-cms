// Field types define value behavior boundaries so content schema stays extension-friendly.
export type FieldTypeDefinition = {
  name: string;
  validate: (value: unknown) => boolean;
  serialize: (value: unknown) => unknown;
  deserialize: (value: unknown) => unknown;
  default?: unknown;
};

export type FieldTypeRegistry = {
  register: (type: FieldTypeDefinition) => FieldTypeDefinition;
  get: (name: string) => FieldTypeDefinition | undefined;
  list: () => FieldTypeDefinition[];
};

const assertFieldType = (type: unknown): FieldTypeDefinition => {
  if (!type || typeof type !== 'object') {
    throw new Error('Invalid field type: expected an object');
  }

  const candidate = type as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';

  if (!name) {
    throw new Error('Invalid field type: name is required');
  }

  if (typeof candidate.validate !== 'function') {
    throw new Error(`Invalid field type "${name}": validate(value) is required`);
  }

  if (typeof candidate.serialize !== 'function') {
    throw new Error(`Invalid field type "${name}": serialize(value) is required`);
  }

  if (typeof candidate.deserialize !== 'function') {
    throw new Error(`Invalid field type "${name}": deserialize(value) is required`);
  }

  return Object.freeze({
    name,
    validate: candidate.validate as FieldTypeDefinition['validate'],
    serialize: candidate.serialize as FieldTypeDefinition['serialize'],
    deserialize: candidate.deserialize as FieldTypeDefinition['deserialize'],
    default: candidate.default
  });
};

export const createFieldTypeRegistry = (): FieldTypeRegistry => {
  const byName = new Map<string, FieldTypeDefinition>();

  return Object.freeze({
    register: (type: FieldTypeDefinition): FieldTypeDefinition => {
      const normalized = assertFieldType(type);

      if (byName.has(normalized.name)) {
        throw new Error(`Field type already registered: ${normalized.name}`);
      }

      byName.set(normalized.name, normalized);
      return normalized;
    },
    get: (name: string): FieldTypeDefinition | undefined => byName.get(name),
    list: (): FieldTypeDefinition[] => Object.freeze([...byName.values()])
  });
};

const DEFAULT_FIELD_TYPES: readonly FieldTypeDefinition[] = Object.freeze([
  Object.freeze({
    name: 'string',
    validate: (value: unknown) => typeof value === 'string',
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
    default: ''
  }),
  Object.freeze({
    name: 'number',
    validate: (value: unknown) => typeof value === 'number' && Number.isFinite(value),
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
    default: 0
  }),
  Object.freeze({
    name: 'boolean',
    validate: (value: unknown) => typeof value === 'boolean',
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
    default: false
  }),
  Object.freeze({
    name: 'date',
    validate: (value: unknown) => value instanceof Date || (typeof value === 'string' && !Number.isNaN(Date.parse(value))),
    serialize: (value: unknown) => value instanceof Date ? value.toISOString() : value,
    deserialize: (value: unknown) => value instanceof Date
      ? value
      : (typeof value === 'string' ? new Date(value) : value),
    default: null
  }),
  Object.freeze({
    name: 'json',
    validate: (_value: unknown) => true,
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
    default: null
  })
]);

export const registerDefaultFieldTypes = (registry: FieldTypeRegistry): void => {
  for (const fieldType of DEFAULT_FIELD_TYPES) {
    if (!registry.get(fieldType.name)) {
      registry.register(fieldType);
    }
  }
};
