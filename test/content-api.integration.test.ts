import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-content-api-'));

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

const requestJson = async (url) => {
  const response = await fetch(url);
  return {
    status: response.status,
    body: await response.json()
  };
};

test('content api: list empty, list entries, and fetch single entry', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const bootstrap = await createBootstrap({ cwd, startupTimestamp });
  const { runtime } = bootstrap;

  runtime.contentTypes.register({
    name: 'Article',
    slug: 'article',
    fields: [
      { name: 'title', type: 'string', required: true }
    ]
  });

  const server = createHttpServer({
    runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const empty = await requestJson(`${baseUrl}/api/content/article`);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, { entries: [] });

    const created = runtime.contentStore.create('article', { title: 'Hello public API' });

    const list = await requestJson(`${baseUrl}/api/content/article`);
    assert.equal(list.status, 200);
    assert.equal(Array.isArray(list.body.entries), true);
    assert.equal(list.body.entries.length, 1);
    assert.deepEqual(list.body.entries[0], {
      id: created.id,
      type: 'article',
      fields: { title: 'Hello public API' },
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    });

    const single = await requestJson(`${baseUrl}/api/content/article/${created.id}`);
    assert.equal(single.status, 200);
    assert.deepEqual(single.body, {
      id: created.id,
      type: 'article',
      fields: { title: 'Hello public API' },
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    });
  } finally {
    await server.stop();
  }
});

test('content api returns 404 for unknown content type', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const bootstrap = await createBootstrap({ cwd, startupTimestamp });

  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const missingTypeList = await requestJson(`${baseUrl}/api/content/missing`);
    assert.equal(missingTypeList.status, 404);
    assert.deepEqual(missingTypeList.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Content type not found: missing'
      }
    });
  } finally {
    await server.stop();
  }
});

test('content api returns 404 for unknown entry id', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const bootstrap = await createBootstrap({ cwd, startupTimestamp });
  const { runtime } = bootstrap;

  runtime.contentTypes.register({
    name: 'Article',
    slug: 'article',
    fields: [
      { name: 'title', type: 'string', required: true }
    ]
  });

  const server = createHttpServer({
    runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const missingEntry = await requestJson(`${baseUrl}/api/content/article/not-found`);
    assert.equal(missingEntry.status, 404);
    assert.deepEqual(missingEntry.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Entry not found: article/not-found'
      }
    });
  } finally {
    await server.stop();
  }
});
