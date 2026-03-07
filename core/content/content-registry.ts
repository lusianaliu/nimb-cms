import { createContentSchema } from './content-schema.ts';
import { validateContentSchema } from './content-validator.ts';

const mutationAllowed = (source) => source === 'admin.command' || source === 'restore';

type FlatContentType = {
  name: string;
  fields: Record<string, string>;
};

export class ContentRegistry {
  constructor() {
    this.schemas = new Map();
    this.contentTypes = new Map<string, FlatContentType>();
  }

  register(schemaInput, { source = 'unknown' } = {}) {
    if (!mutationAllowed(source)) {
      throw new Error('Content schema mutations require admin command');
    }

    const schema = createContentSchema(schemaInput);
    const validation = validateContentSchema(schema);

    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    this.schemas.set(schema.name, Object.freeze({ schema, validation }));

    return schema;
  }

  get(name) {
    return this.schemas.get(name)?.schema ?? null;
  }

  list() {
    return Object.freeze([...this.schemas.values()]
      .map((entry) => entry.schema)
      .sort((left, right) => left.name.localeCompare(right.name)));
  }

  registerContentType(type: FlatContentType) {
    if (!type || typeof type !== 'object') {
      throw new Error('Content type must be an object');
    }

    const name = String(type.name ?? '').trim();
    if (!name) {
      throw new Error('Content type name is required');
    }

    if (this.contentTypes.has(name)) {
      throw new Error(`Content type already registered: ${name}`);
    }

    const fields = type.fields && typeof type.fields === 'object' && !Array.isArray(type.fields)
      ? { ...type.fields }
      : {};

    this.contentTypes.set(name, Object.freeze({ name, fields: Object.freeze(fields) }));
    return this.getContentType(name);
  }

  getContentType(name: string): FlatContentType | null {
    return this.contentTypes.get(name) ?? null;
  }

  listContentTypes(): FlatContentType[] {
    return [...this.contentTypes.values()];
  }

  inspectorSnapshot() {
    const types = this.list();
    const validationErrors = [];

    for (const schema of types) {
      const result = validateContentSchema(schema);
      if (!result.valid) {
        validationErrors.push(Object.freeze({ name: schema.name, errors: result.errors }));
      }
    }

    return Object.freeze({
      registeredTypes: Object.freeze(types.map((schema) => schema.name)),
      schemaHashes: Object.freeze(types.map((schema) => Object.freeze({ name: schema.name, hash: schema.hash }))),
      validation: Object.freeze({
        valid: validationErrors.length === 0,
        errors: Object.freeze(validationErrors)
      })
    });
  }
}
