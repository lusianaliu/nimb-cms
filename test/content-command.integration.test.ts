import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from '../core/events/event-bus.ts';
import {
  ContentTypeRegistry,
  ContentStore,
  ContentCommandService,
  CONTENT_CREATED_EVENT,
  CONTENT_UPDATED_EVENT,
  CONTENT_DELETED_EVENT,
  type ContentEvents
} from '../core/content/index.ts';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-content-command-'));

const writeConfig = (cwd) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

test('content command service delegates mutations and persists snapshots', async () => {
  const types = new ContentTypeRegistry();
  types.register({
    name: 'Article',
    slug: 'article',
    fields: [{ name: 'title', type: 'string', required: true }]
  });

  const store = new ContentStore(types);
  let persistCalls = 0;
  const service = new ContentCommandService(store, async () => {
    persistCalls += 1;
  });

  const created = await service.create('article', { title: 'Created' });
  assert.equal(created.type, 'article');
  assert.deepEqual(created.data, { title: 'Created' });
  assert.equal(persistCalls, 1);

  const updated = await service.update('article', created.id, { title: 'Updated' });
  assert.equal(updated.id, created.id);
  assert.deepEqual(updated.data, { title: 'Updated' });
  assert.equal(persistCalls, 2);

  await service.delete('article', created.id);
  assert.equal(store.get('article', created.id), undefined);
  assert.equal(persistCalls, 3);
});

test('content command service emits mutation events', async () => {
  const types = new ContentTypeRegistry();
  types.register({
    name: 'Article',
    slug: 'article',
    fields: [{ name: 'title', type: 'string', required: true }]
  });

  const store = new ContentStore(types);
  const eventBus = new EventEmitter<ContentEvents>();
  const events: Array<{ eventName: string; payload: { type: string; entry: { id: string } } }> = [];

  eventBus.on(CONTENT_CREATED_EVENT, (payload) => {
    events.push({ eventName: CONTENT_CREATED_EVENT, payload });
  });

  eventBus.on(CONTENT_UPDATED_EVENT, (payload) => {
    events.push({ eventName: CONTENT_UPDATED_EVENT, payload });
  });

  eventBus.on(CONTENT_DELETED_EVENT, (payload) => {
    events.push({ eventName: CONTENT_DELETED_EVENT, payload });
  });

  const service = new ContentCommandService(store, async () => {}, eventBus);

  const created = await service.create('article', { title: 'Created' });
  await service.update('article', created.id, { title: 'Updated' });
  await service.delete('article', created.id);

  assert.equal(events.length, 3);
  assert.deepEqual(events.map((event) => event.eventName), [
    CONTENT_CREATED_EVENT,
    CONTENT_UPDATED_EVENT,
    CONTENT_DELETED_EVENT
  ]);
  assert.equal(events[0]?.payload.type, 'article');
  assert.equal(events[0]?.payload.entry.id, created.id);
  assert.equal(events[1]?.payload.entry.id, created.id);
  assert.equal(events[2]?.payload.entry.id, created.id);
});

test('content API mutation routes call runtime.contentCommand without response changes', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const bootstrap = await createBootstrap({ cwd, startupTimestamp });
  const { runtime } = bootstrap;

  runtime.contentTypes.register({
    name: 'Article',
    slug: 'article',
    fields: [{ name: 'title', type: 'string', required: true }]
  });

  const counts = { create: 0, update: 0, delete: 0 };
  const originalCommand = runtime.contentCommand;
  runtime.contentCommand = {
    create: async (type, data) => {
      counts.create += 1;
      return originalCommand.create(type, data);
    },
    update: async (type, id, data) => {
      counts.update += 1;
      return originalCommand.update(type, id, data);
    },
    delete: async (type, id) => {
      counts.delete += 1;
      return originalCommand.delete(type, id);
    }
  };

  const server = createHttpServer({
    runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const createdResponse = await fetch(`${baseUrl}/api/content/article`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { title: 'Created via command service' } })
    });

    assert.equal(createdResponse.status, 201);
    const createdBody = await createdResponse.json();
    assert.equal(createdBody.type, 'article');
    assert.deepEqual(createdBody.fields, { title: 'Created via command service' });

    const updatedResponse = await fetch(`${baseUrl}/api/content/article/${createdBody.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { title: 'Updated via command service' } })
    });

    assert.equal(updatedResponse.status, 200);
    const updatedBody = await updatedResponse.json();
    assert.equal(updatedBody.id, createdBody.id);
    assert.deepEqual(updatedBody.fields, { title: 'Updated via command service' });

    const deletedResponse = await fetch(`${baseUrl}/api/content/article/${createdBody.id}`, {
      method: 'DELETE'
    });

    assert.equal(deletedResponse.status, 204);
    assert.equal(await deletedResponse.text(), '');

    assert.deepEqual(counts, { create: 1, update: 1, delete: 1 });
  } finally {
    await server.stop();
  }
});
