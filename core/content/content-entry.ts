import { randomUUID } from 'node:crypto';
import type { ContentFieldDefinition } from './content-type-registry.ts';
import { ContentTypeRegistry } from './content-type-registry.ts';

export interface ContentEntry {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isValidFieldType = (field: ContentFieldDefinition, value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  switch (field.type) {
    case 'string':
    case 'text':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'datetime':
      return value instanceof Date && !Number.isNaN(value.getTime());
    default:
      return false;
  }
};

const describeValueType = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (value instanceof Date) {
    return 'Date';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
};

export const createContentEntry = (
  registry: ContentTypeRegistry,
  typeSlug: string,
  data: Record<string, unknown>
): ContentEntry => {
  const definition = registry.get(typeSlug);
  if (!definition) {
    throw new Error(`Unknown content type: ${typeSlug}`);
  }

  const fieldByName = new Map(definition.fields.map((field) => [field.name, field]));

  for (const key of Object.keys(data)) {
    if (!fieldByName.has(key)) {
      throw new Error(`Unknown field "${key}" for content type "${typeSlug}"`);
    }
  }

  for (const field of definition.fields) {
    const hasField = hasOwn(data, field.name);
    if (field.required && !hasField) {
      throw new Error(`Missing required field "${field.name}" for content type "${typeSlug}"`);
    }

    if (!hasField) {
      continue;
    }

    const value = data[field.name];
    if (!isValidFieldType(field, value)) {
      throw new Error(
        `Invalid type for field "${field.name}" on content type "${typeSlug}": expected ${field.type}, received ${describeValueType(value)}`
      );
    }
  }

  const now = new Date();

  return {
    id: randomUUID(),
    type: typeSlug,
    data: { ...data },
    createdAt: now,
    updatedAt: new Date(now)
  };
};
