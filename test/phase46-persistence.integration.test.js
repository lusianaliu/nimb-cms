import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase46-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
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

const getJson = async (url) => {
  const response = await fetch(url);
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

test('phase 46: entries persist to deterministic filesystem storage across restarts', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const first = await startServer(cwd);

  let createdId = '';
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
      title: 'Persistent title',
      body: 'Persistent body'
    }, headers);
    assert.equal(created.status, 200);
    createdId = created.body.data.entry.id;
  } finally {
    await first.server.stop();
  }

  const storageFile = path.join(cwd, 'data', 'entries.json');
  assert.equal(fs.existsSync(storageFile), true);
  const persistedPayload = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
  assert.equal(Array.isArray(persistedPayload.entries), true);
  assert.equal(persistedPayload.entries.some((entry) => entry.id === createdId), true);

  const second = await startServer(cwd);
  try {
    const baseUrl = `http://127.0.0.1:${second.port}`;
    const restored = await getJson(`${baseUrl}/api/entries/article`);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.entries.length, 1);
    assert.equal(restored.body.data.entries[0].id, createdId);
  } finally {
    await second.server.stop();
  }
});
