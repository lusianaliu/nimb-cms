import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentTypeRegistry, type ContentTypeDefinition } from '../core/content/content-type-registry.ts';

const articleDefinition: ContentTypeDefinition = {
  name: 'Article',
  slug: 'article',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'body', type: 'text' }
  ]
};

test('content type registry registers definitions', () => {
  const registry = new ContentTypeRegistry();

  registry.register(articleDefinition);

  assert.equal(registry.get('article')?.name, 'Article');
});

test('content type registry rejects duplicate slugs', () => {
  const registry = new ContentTypeRegistry();

  registry.register(articleDefinition);

  assert.throws(
    () => registry.register(articleDefinition),
    /Content type already registered for slug: article/
  );
});

test('content type registry retrieves registered definition by slug', () => {
  const registry = new ContentTypeRegistry();

  registry.register(articleDefinition);

  const found = registry.get('article');

  assert.deepEqual(found, articleDefinition);
  assert.equal(registry.get('missing'), undefined);
});

test('content type registry lists registered definitions', () => {
  const registry = new ContentTypeRegistry();
  const pageDefinition: ContentTypeDefinition = {
    name: 'Page',
    slug: 'page',
    fields: [{ name: 'title', type: 'string', required: true }]
  };

  registry.register(articleDefinition);
  registry.register(pageDefinition);

  assert.deepEqual(registry.list(), [articleDefinition, pageDefinition]);
});
