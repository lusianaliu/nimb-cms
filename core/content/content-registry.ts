import { createContentSchema } from './content-schema.ts';
import { validateContentSchema } from './content-validator.ts';

const mutationAllowed = (source) => source === 'admin.command' || source === 'restore';

export class ContentRegistry {
  constructor() {
    this.schemas = new Map();
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
