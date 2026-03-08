import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldTypeRegistry } from '../core/content/field-types.ts';

test('phase 134: field type registry registers and retrieves field types', () => {
  const registry = createFieldTypeRegistry();

  registry.register({
    name: 'slug',
    validate: (value) => typeof value === 'string' && value.length > 0,
    serialize: (value) => String(value),
    deserialize: (value) => String(value),
    default: ''
  });

  const type = registry.get('slug');
  assert.ok(type);
  assert.equal(type?.name, 'slug');
  assert.equal(type?.validate('hello-world'), true);
  assert.equal(type?.validate(''), false);
});

test('phase 134: field type registry rejects duplicate names', () => {
  const registry = createFieldTypeRegistry();
  const definition = {
    name: 'string-list',
    validate: (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string'),
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
    default: []
  };

  registry.register(definition);

  assert.throws(() => registry.register(definition), /Field type already registered: string-list/);
});

test('phase 134: field type registry validates required methods', () => {
  const registry = createFieldTypeRegistry();

  assert.throws(() => registry.register({ name: 'broken' } as never), /validate\(value\) is required/);
  assert.throws(() => registry.register({
    name: 'broken-serialize',
    validate: () => true
  } as never), /serialize\(value\) is required/);
  assert.throws(() => registry.register({
    name: 'broken-deserialize',
    validate: () => true,
    serialize: (value: unknown) => value
  } as never), /deserialize\(value\) is required/);
});
