import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase41-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
};

const getJson = async (url, headers = {}) => {
  const response = await fetch(url, { headers });
  return { status: response.status, body: await response.json() };
};

const postJson = async (url, body = {}, headers = {}) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });

  return { status: response.status, body: await response.json() };
};

const startServer = async (cwd) => {
  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  const clockValues = [
    '2026-01-01T00:00:10.000Z',
    '2026-01-01T00:00:11.000Z',
    '2026-01-01T00:00:12.000Z',
    '2026-01-01T00:00:13.000Z',
    '2026-01-01T00:00:14.000Z'
  ];
  let index = 0;

  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0,
    clock: () => {
      const value = clockValues[Math.min(index, clockValues.length - 1)];
      index += 1;
      return value;
    },
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController,
    contentRegistry: bootstrap.contentRegistry,
    persistContentTypes: bootstrap.persistContentTypes,
    entryRegistry: bootstrap.entryRegistry,
    persistEntries: bootstrap.persistEntries
  });

  const { port } = await server.start();
  return { server, port };
};

test('phase 41: deterministic entry lifecycle transitions', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const first = await startServer(cwd);
  let entryId = '';

  try {
    const baseUrl = `http://127.0.0.1:${first.port}`;
    const login = await postJson(`${baseUrl}/api/auth/login`, { username: 'admin', password: 'admin' });
    const token = login.body.data.session.token;
    const headers = { authorization: `Bearer ${token}` };

    const schemaCreated = await postJson(`${baseUrl}/api/admin/content-types`, {
      name: 'article',
      fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'body', type: 'text', required: true }
      ]
    }, headers);
    assert.equal(schemaCreated.status, 200);

    const created = await postJson(`${baseUrl}/api/admin/entries/article`, {
      title: 'Lifecycle',
      body: 'Entry'
    }, headers);
    assert.equal(created.status, 200);
    assert.equal(created.body.data.entry.state, 'draft');
    entryId = created.body.data.entry.id;

    const invalid = await postJson(`${baseUrl}/api/admin/entries/article/${encodeURIComponent(entryId)}/archive`, {}, headers);
    assert.equal(invalid.status, 400);

    const published = await postJson(`${baseUrl}/api/admin/entries/article/${encodeURIComponent(entryId)}/publish`, {}, headers);
    assert.equal(published.status, 200);
    assert.equal(published.body.data.entry.state, 'published');

    const archived = await postJson(`${baseUrl}/api/admin/entries/article/${encodeURIComponent(entryId)}/archive`, {}, headers);
    assert.equal(archived.status, 200);
    assert.equal(archived.body.data.entry.state, 'archived');

    const backToDraft = await postJson(`${baseUrl}/api/admin/entries/article/${encodeURIComponent(entryId)}/draft`, {}, headers);
    assert.equal(backToDraft.status, 200);
    assert.equal(backToDraft.body.data.entry.state, 'draft');

    const listed = await getJson(`${baseUrl}/api/entries/article`);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.entries[0].state, 'draft');

    const inspector = await getJson(`${baseUrl}/inspector`);
    assert.equal(inspector.status, 200);
    assert.deepEqual(inspector.body.entries, [{ type: 'article', count: 1, states: { draft: 1, published: 0, archived: 0 } }]);
  } finally {
    await first.server.stop();
  }

  const persisted = fs.readFileSync(path.join(cwd, '.nimb', 'content-entries.json'), 'utf8');

  const second = await startServer(cwd);
  try {
    const baseUrl = `http://127.0.0.1:${second.port}`;
    const restored = await getJson(`${baseUrl}/api/entries/article/${encodeURIComponent(entryId)}`);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.entry.state, 'draft');

    const persistedReplay = fs.readFileSync(path.join(cwd, '.nimb', 'content-entries.json'), 'utf8');
    assert.equal(persistedReplay, persisted);
  } finally {
    await second.server.stop();
  }
});
