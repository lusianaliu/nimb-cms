import { canonicalizeEntryData } from './entry-schema.ts';

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number.isFinite(Number(value));
  }

  return false;
};

const isValidDatetime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

const validateField = (field, value) => {
  if (value === null || value === undefined) {
    return field.required ? [`Missing required field: ${field.name}`] : [];
  }

  if (field.type === 'string' || field.type === 'text') {
    return typeof value === 'string' ? [] : [`Field ${field.name} must be ${field.type}`];
  }

  if (field.type === 'number') {
    return toNumber(value) ? [] : [`Field ${field.name} must be number`];
  }

  if (field.type === 'boolean') {
    return typeof value === 'boolean' ? [] : [`Field ${field.name} must be boolean`];
  }

  if (field.type === 'datetime') {
    return isValidDatetime(value) ? [] : [`Field ${field.name} must be datetime`];
  }

  return [`Unsupported field type: ${field.type}`];
};

export const validateEntryData = ({ schema, input }) => {
  const errors = [];
  const data = canonicalizeEntryData(input);
  const fieldIndex = new Map((schema?.fields ?? []).map((field) => [field.name, field]));

  for (const field of schema?.fields ?? []) {
    errors.push(...validateField(field, data[field.name]));
  }

  for (const key of Object.keys(data)) {
    if (!fieldIndex.has(key)) {
      errors.push(`Unknown field: ${key}`);
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    data
  });
};
