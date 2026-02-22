import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase40-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
};

const getJson = async (url, headers = {}) => {
  const response = await fetch(url, { headers });
  return { status: response.status, body: await response.json() };
};

const postJson = async (url, body, headers = {}) => {
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
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0,
    clock: () => '2026-01-01T00:00:10.000Z',
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

test('phase 40: deterministic content entries', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const first = await startServer(cwd);

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

    const firstEntry = await postJson(`${baseUrl}/api/admin/entries/article`, {
      title: 'B title',
      body: 'second'
    }, headers);
    assert.equal(firstEntry.status, 200);

    const secondEntry = await postJson(`${baseUrl}/api/admin/entries/article`, {
      body: 'first',
      title: 'A title'
    }, headers);
    assert.equal(secondEntry.status, 200);

    const invalid = await postJson(`${baseUrl}/api/admin/entries/article`, {
      title: 'missing body'
    }, headers);
    assert.equal(invalid.status, 400);

    const listed = await getJson(`${baseUrl}/api/entries/article`);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.entries.length, 2);
    assert.deepEqual(
      listed.body.data.entries.map((entry) => entry.id),
      [...listed.body.data.entries.map((entry) => entry.id)].sort((left, right) => left.localeCompare(right))
    );

    const byId = await getJson(`${baseUrl}/api/entries/article/${encodeURIComponent(listed.body.data.entries[0].id)}`);
    assert.equal(byId.status, 200);

    const inspector = await getJson(`${baseUrl}/inspector`);
    assert.equal(inspector.status, 200);
    assert.deepEqual(inspector.body.entries, [{ type: 'article', count: 2 }]);
  } finally {
    await first.server.stop();
  }

  const persisted = fs.readFileSync(path.join(cwd, '.nimb', 'content-entries.json'), 'utf8');

  const second = await startServer(cwd);
  try {
    const baseUrl = `http://127.0.0.1:${second.port}`;
    const restored = await getJson(`${baseUrl}/api/entries/article`);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.entries.length, 2);

    const persistedReplay = fs.readFileSync(path.join(cwd, '.nimb', 'content-entries.json'), 'utf8');
    assert.equal(persistedReplay, persisted);
  } finally {
    await second.server.stop();
  }
});
