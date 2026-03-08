import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentTypeRegistry } from '../core/content/content-types.ts';

test('phase 133: content type registry registers, retrieves, and rejects duplicates', () => {
  const registry = createContentTypeRegistry();
  const schema = {
    name: 'post',
    label: 'Posts',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'richtext' },
      { name: 'createdAt', type: 'date' }
    ]
  };

  registry.register(schema);

  assert.deepEqual(registry.get('post'), {
    name: 'post',
    label: 'Posts',
    slug: 'post',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'richtext', required: false },
      { name: 'createdAt', type: 'date', required: false }
    ]
  });

  assert.throws(() => registry.register(schema), /Content type already registered: post/);
});


test('phase 133: content type registry validates schema shape', () => {
  const registry = createContentTypeRegistry();

  assert.throws(() => registry.register({ name: '', fields: [] } as never), /name is required/);
  assert.throws(() => registry.register({ name: 'article', fields: {} } as never), /fields must be an array/);
});
