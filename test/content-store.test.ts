import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentStore } from '../core/content/content-store.ts';
import { ContentTypeRegistry } from '../core/content/content-type-registry.ts';

const createRegistry = () => {
  const registry = new ContentTypeRegistry();

  registry.register({
    name: 'Article',
    slug: 'article',
    fields: [
      { name: 'title', type: 'string', required: true }
    ]
  });

  registry.register({
    name: 'Page',
    slug: 'page',
    fields: [
      { name: 'title', type: 'string', required: true }
    ]
  });

  return registry;
};

test('content store creates entries for a registered content type', () => {
  const store = new ContentStore(createRegistry());

  const entry = store.create('article', { title: 'Hello world' });

  assert.equal(entry.type, 'article');
  assert.equal(entry.data.title, 'Hello world');
  assert.equal(store.list('article').length, 1);
});

test('content store retrieves entries by id within the same content type', () => {
  const store = new ContentStore(createRegistry());
  const created = store.create('article', { title: 'Find me' });

  const entry = store.get('article', created.id);

  assert.ok(entry);
  assert.equal(entry?.id, created.id);
  assert.equal(entry?.data.title, 'Find me');
});

test('content store lists entries for a content type and returns empty array when none exist', () => {
  const store = new ContentStore(createRegistry());

  assert.deepEqual(store.list('article'), []);

  store.create('article', { title: 'First' });
  store.create('article', { title: 'Second' });

  const entries = store.list('article');

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.data.title), ['First', 'Second']);
});

test('content store keeps entries separated by content type', () => {
  const store = new ContentStore(createRegistry());
  const article = store.create('article', { title: 'Article title' });

  store.create('page', { title: 'Page title' });

  assert.equal(store.get('page', article.id), undefined);
  assert.equal(store.list('article').length, 1);
  assert.equal(store.list('page').length, 1);
});

test('content store rejects unknown content types', () => {
  const store = new ContentStore(createRegistry());

  assert.throws(
    () => store.create('missing', { title: 'Unknown' }),
    /Unknown content type: missing/
  );

  assert.throws(
    () => store.get('missing', 'id'),
    /Unknown content type: missing/
  );

  assert.throws(
    () => store.list('missing'),
    /Unknown content type: missing/
  );
});
