import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentEntry } from '../core/content/content-entry.ts';
import { ContentTypeRegistry, type ContentTypeDefinition } from '../core/content/content-type-registry.ts';

const articleDefinition: ContentTypeDefinition = {
  name: 'Article',
  slug: 'article',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'body', type: 'text' },
    { name: 'published', type: 'boolean' }
  ]
};

const createRegistry = () => {
  const registry = new ContentTypeRegistry();
  registry.register(articleDefinition);
  return registry;
};

test('createContentEntry creates a valid content entry', () => {
  const entry = createContentEntry(createRegistry(), 'article', {
    title: 'Hello world',
    body: 'Body text',
    published: false
  });

  assert.equal(entry.type, 'article');
  assert.equal(typeof entry.id, 'string');
  assert.notEqual(entry.id.length, 0);
  assert.deepEqual(entry.data, {
    title: 'Hello world',
    body: 'Body text',
    published: false
  });
  assert.ok(entry.createdAt instanceof Date);
  assert.ok(entry.updatedAt instanceof Date);
});

test('createContentEntry throws when required fields are missing', () => {
  assert.throws(
    () => createContentEntry(createRegistry(), 'article', { body: 'Body text' }),
    /Missing required field "title" for content type "article"/
  );
});

test('createContentEntry throws when field type does not match definition', () => {
  assert.throws(
    () => createContentEntry(createRegistry(), 'article', {
      title: 42,
      body: 'Body text'
    }),
    /Invalid type for field "title" on content type "article": expected string, received number/
  );
});

test('createContentEntry rejects unknown fields', () => {
  assert.throws(
    () => createContentEntry(createRegistry(), 'article', {
      title: 'Hello world',
      summary: 'unknown field'
    }),
    /Unknown field "summary" for content type "article"/
  );
});
