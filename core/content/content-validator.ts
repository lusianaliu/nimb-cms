import { getSupportedFieldTypes, normalizeContentSchema } from './content-schema.ts';

const SUPPORTED_TYPES = new Set(getSupportedFieldTypes());

export const validateContentSchema = (schema) => {
  const normalized = normalizeContentSchema(schema);
  const errors = [];

  if (!normalized.name) {
    errors.push('Schema name is required');
  }

  const fieldNames = new Set();

  for (const field of normalized.fields) {
    if (!field.name) {
      errors.push('Field name is required');
      continue;
    }

    if (fieldNames.has(field.name)) {
      errors.push(`Duplicate field name: ${field.name}`);
    }
    fieldNames.add(field.name);

    if (!SUPPORTED_TYPES.has(field.type)) {
      errors.push(`Unsupported field type: ${field.type}`);
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors)
  });
};
