import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase42-'));

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
  let tick = 0;
  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0,
    clock: () => {
      const timestamp = `2026-01-01T00:00:${String(10 + tick).padStart(2, '0')}.000Z`;
      tick += 1;
      return timestamp;
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

test('phase 42: deterministic query engine', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const first = await startServer(cwd);
  let expectedDefaultOrder = [];

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

    const one = await postJson(`${baseUrl}/api/admin/entries/article`, { title: 'one', body: 'alpha' }, headers);
    const two = await postJson(`${baseUrl}/api/admin/entries/article`, { title: 'two', body: 'beta' }, headers);
    const three = await postJson(`${baseUrl}/api/admin/entries/article`, { title: 'three', body: 'gamma' }, headers);
    assert.equal(one.status, 200);
    assert.equal(two.status, 200);
    assert.equal(three.status, 200);

    await postJson(`${baseUrl}/api/admin/entries/article/${encodeURIComponent(one.body.data.entry.id)}/publish`, {}, headers);
    await postJson(`${baseUrl}/api/admin/entries/article/${encodeURIComponent(three.body.data.entry.id)}/publish`, {}, headers);

    const defaultList = await getJson(`${baseUrl}/api/entries/article`);
    assert.equal(defaultList.status, 200);
    expectedDefaultOrder = defaultList.body.data.entries.map((entry) => entry.id);

    const deterministicReplay = await getJson(`${baseUrl}/api/entries/article`);
    assert.deepEqual(deterministicReplay.body.data.entries.map((entry) => entry.id), expectedDefaultOrder);

    const filtered = await getJson(`${baseUrl}/api/entries/article?state=published`);
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data.entries.length, 2);
    assert.deepEqual(filtered.body.data.entries.map((entry) => entry.state), ['published', 'published']);

    const sortedDesc = await getJson(`${baseUrl}/api/entries/article?sort=createdAt&order=desc`);
    assert.equal(sortedDesc.status, 200);
    assert.deepEqual(sortedDesc.body.data.entries.map((entry) => entry.id), [...expectedDefaultOrder].reverse());

    const pageA = await getJson(`${baseUrl}/api/entries/article?sort=createdAt&order=asc&offset=0&limit=2`);
    const pageB = await getJson(`${baseUrl}/api/entries/article?sort=createdAt&order=asc&offset=2&limit=2`);
    assert.equal(pageA.status, 200);
    assert.equal(pageB.status, 200);
    assert.deepEqual([...pageA.body.data.entries, ...pageB.body.data.entries].map((entry) => entry.id), expectedDefaultOrder);

    const inspector = await getJson(`${baseUrl}/inspector`);
    assert.equal(inspector.status, 200);
    assert.equal(inspector.body.entryQuery.totalQueries >= 1, true);
    assert.equal(inspector.body.entryQuery.lastQuery.sort, 'createdAt');
  } finally {
    await first.server.stop();
  }

  const second = await startServer(cwd);
  try {
    const baseUrl = `http://127.0.0.1:${second.port}`;
    const restored = await getJson(`${baseUrl}/api/entries/article`);
    assert.equal(restored.status, 200);
    assert.deepEqual(restored.body.data.entries.map((entry) => entry.id), expectedDefaultOrder);
  } finally {
    await second.server.stop();
  }
});
