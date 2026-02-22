import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase39-'));

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
    persistContentTypes: bootstrap.persistContentTypes
  });

  const { port } = await server.start();
  return { server, port };
};

test('phase 39: deterministic content model system', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const first = await startServer(cwd);

  try {
    const baseUrl = `http://127.0.0.1:${first.port}`;

    const unauth = await postJson(`${baseUrl}/api/admin/content-types`, { name: 'article', fields: [] });
    assert.equal(unauth.status, 401);

    const login = await postJson(`${baseUrl}/api/auth/login`, { username: 'admin', password: 'admin' });
    const token = login.body.data.session.token;
    const headers = { authorization: `Bearer ${token}` };

    const created = await postJson(`${baseUrl}/api/admin/content-types`, {
      name: 'article',
      fields: [
        { name: 'publishedAt', type: 'datetime', required: false },
        { name: 'title', type: 'string', required: true },
        { name: 'body', type: 'text', required: true }
      ]
    }, headers);

    assert.equal(created.status, 200);
    assert.deepEqual(created.body.data.contentType.fields.map((field) => field.name), ['body', 'publishedAt', 'title']);

    const invalid = await postJson(`${baseUrl}/api/admin/content-types`, {
      name: 'broken',
      fields: [{ name: 'unknown', type: 'json', required: true }]
    }, headers);
    assert.equal(invalid.status, 400);

    const listed = await getJson(`${baseUrl}/api/content-types`);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.contentTypes.length, 1);

    const schema = await getJson(`${baseUrl}/api/content-types/article`);
    assert.equal(schema.status, 200);
    assert.equal(typeof schema.body.data.contentType.hash, 'string');

    const inspector = await getJson(`${baseUrl}/inspector`);
    assert.equal(inspector.status, 200);
    assert.deepEqual(inspector.body.content.registeredTypes, ['article']);
    assert.equal(inspector.body.content.validation.valid, true);
  } finally {
    await first.server.stop();
  }

  const persisted = fs.readFileSync(path.join(cwd, '.nimb', 'content-types.json'), 'utf8');

  const second = await startServer(cwd);
  try {
    const baseUrl = `http://127.0.0.1:${second.port}`;
    const restored = await getJson(`${baseUrl}/api/content-types/article`);
    assert.equal(restored.status, 200);

    const persistedReplay = fs.readFileSync(path.join(cwd, '.nimb', 'content-types.json'), 'utf8');
    assert.equal(persistedReplay, persisted);
  } finally {
    await second.server.stop();
  }
});
