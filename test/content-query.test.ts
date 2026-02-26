import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentTypeRegistry, ContentStore, ContentQueryService } from '../core/content/index.ts';

const createQuery = () => {
  const registry = new ContentTypeRegistry();
  registry.register({
    name: 'Page',
    slug: 'page',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'order', type: 'number' }
    ]
  });

  const store = new ContentStore(registry);
  return { store, query: new ContentQueryService(store) };
};

test('content query service lists entries from content store', () => {
  const { store, query } = createQuery();
  const first = store.create('page', { title: 'First', order: 2 });
  const second = store.create('page', { title: 'Second', order: 1 });

  const entries = query.list('page');
  assert.deepEqual(entries.map((entry) => entry.id), [first.id, second.id]);
});

test('content query service supports deterministic sort and pagination', () => {
  const { store, query } = createQuery();
  store.create('page', { title: 'Charlie', order: 3 });
  store.create('page', { title: 'Alpha', order: 1 });
  store.create('page', { title: 'Bravo', order: 2 });

  const sorted = query.list('page', {
    sort: {
      field: 'title',
      direction: 'asc'
    },
    offset: 1,
    limit: 1
  });

  assert.equal(sorted.length, 1);
  assert.equal(sorted[0].data.title, 'Bravo');
});

test('content query service gets a single entry', () => {
  const { store, query } = createQuery();
  const created = store.create('page', { title: 'Single', order: 1 });

  const found = query.get('page', created.id);
  assert.equal(found?.id, created.id);
});
