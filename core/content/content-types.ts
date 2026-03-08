export type ContentTypeFieldSchema = {
  name: string;
  type: string;
  required?: boolean;
};

export type ContentTypeSchema = {
  name: string;
  label?: string;
  slug?: string;
  fields: ContentTypeFieldSchema[];
};

export type ContentTypeRegistry = {
  register: (schema: ContentTypeSchema) => ContentTypeSchema;
  get: (name: string) => ContentTypeSchema | undefined;
  list: () => ContentTypeSchema[];
};

const assertFieldSchema = (field: unknown, typeName: string, index: number): ContentTypeFieldSchema => {
  if (!field || typeof field !== 'object') {
    throw new Error(`Invalid content type schema "${typeName}": field at index ${index} must be an object`);
  }

  const candidate = field as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const type = typeof candidate.type === 'string' ? candidate.type.trim() : '';

  if (!name) {
    throw new Error(`Invalid content type schema "${typeName}": field at index ${index} is missing a valid name`);
  }

  if (!type) {
    throw new Error(`Invalid content type schema "${typeName}": field "${name}" is missing a valid type`);
  }

  if (candidate.required !== undefined && typeof candidate.required !== 'boolean') {
    throw new Error(`Invalid content type schema "${typeName}": field "${name}" required must be a boolean when provided`);
  }

  return Object.freeze({
    name,
    type,
    required: candidate.required === true
  });
};

const normalizeSchema = (schema: unknown): ContentTypeSchema => {
  if (!schema || typeof schema !== 'object') {
    throw new Error('Invalid content type schema: expected an object');
  }

  const candidate = schema as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';

  if (!name) {
    throw new Error('Invalid content type schema: name is required');
  }

  const label = typeof candidate.label === 'string' && candidate.label.trim().length > 0
    ? candidate.label.trim()
    : name;

  const slug = typeof candidate.slug === 'string' && candidate.slug.trim().length > 0
    ? candidate.slug.trim()
    : name;

  if (!Array.isArray(candidate.fields)) {
    throw new Error(`Invalid content type schema "${name}": fields must be an array`);
  }

  const fields = candidate.fields.map((field, index) => assertFieldSchema(field, name, index));

  return Object.freeze({
    name,
    label,
    slug,
    fields: Object.freeze(fields)
  });
};

export const createContentTypeRegistry = (): ContentTypeRegistry => {
  const byName = new Map<string, ContentTypeSchema>();
  const bySlug = new Map<string, ContentTypeSchema>();

  return Object.freeze({
    register: (schema: ContentTypeSchema): ContentTypeSchema => {
      const normalized = normalizeSchema(schema);

      if (byName.has(normalized.name)) {
        throw new Error(`Content type already registered: ${normalized.name}`);
      }

      if (normalized.slug && bySlug.has(normalized.slug)) {
        throw new Error(`Content type slug already registered: ${normalized.slug}`);
      }

      byName.set(normalized.name, normalized);
      bySlug.set(normalized.slug ?? normalized.name, normalized);

      return normalized;
    },
    get: (name: string): ContentTypeSchema | undefined => byName.get(name) ?? bySlug.get(name),
    list: (): ContentTypeSchema[] => Object.freeze([...byName.values()])
  });
};
