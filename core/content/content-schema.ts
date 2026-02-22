import { createHash } from 'node:crypto';

const SUPPORTED_FIELD_TYPES = Object.freeze(['string', 'text', 'number', 'boolean', 'datetime']);

const compareFields = (left, right) => {
  const byName = left.name.localeCompare(right.name);
  if (byName !== 0) {
    return byName;
  }

  const byType = left.type.localeCompare(right.type);
  if (byType !== 0) {
    return byType;
  }

  return Number(left.required) - Number(right.required);
};

const normalizeField = (field) => Object.freeze({
  name: String(field?.name ?? '').trim(),
  type: String(field?.type ?? '').trim(),
  required: field?.required === true
});

export const getSupportedFieldTypes = () => Object.freeze([...SUPPORTED_FIELD_TYPES]);

export const normalizeContentSchema = (schema) => {
  const normalized = {
    name: String(schema?.name ?? '').trim(),
    fields: Array.isArray(schema?.fields)
      ? schema.fields.map((field) => normalizeField(field)).sort(compareFields)
      : []
  };

  return Object.freeze({
    name: normalized.name,
    fields: Object.freeze([...normalized.fields])
  });
};

export const computeSchemaHash = (schema) => {
  const normalized = normalizeContentSchema(schema);
  const payload = JSON.stringify({ name: normalized.name, fields: normalized.fields });
  return createHash('sha256').update(payload).digest('hex');
};

export const createContentSchema = (schema) => {
  const normalized = normalizeContentSchema(schema);
  return Object.freeze({
    ...normalized,
    hash: computeSchemaHash(normalized)
  });
};
