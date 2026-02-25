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

const requestJson = async (url, options = undefined) => {
  const response = await fetch(url, options);
  return {
    status: response.status,
    body: await response.json()
  };
};

const requestRaw = async (url, options = undefined) => {
  const response = await fetch(url, options);
  return {
    status: response.status,
    body: await response.text()
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


test('content api creates an entry via POST /api/content/:type', async () => {
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

    const created = await requestJson(`${baseUrl}/api/content/article`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          title: 'Created via API'
        }
      })
    });

    assert.equal(created.status, 201);
    assert.equal(typeof created.body.id, 'string');
    assert.equal(created.body.type, 'article');
    assert.deepEqual(created.body.fields, { title: 'Created via API' });
    assert.equal(typeof created.body.createdAt, 'string');
    assert.equal(typeof created.body.updatedAt, 'string');

    const listed = await requestJson(`${baseUrl}/api/content/article`);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.entries.length, 1);
    assert.deepEqual(listed.body.entries[0], created.body);
  } finally {
    await server.stop();
  }
});

test('content api create returns 404 for unknown content type', async () => {
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

    const missingType = await requestJson(`${baseUrl}/api/content/missing`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        fields: { title: 'No type' }
      })
    });

    assert.equal(missingType.status, 404);
    assert.deepEqual(missingType.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Content type not found: missing'
      }
    });
  } finally {
    await server.stop();
  }
});

test('content api create returns 400 when fields are missing', async () => {
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

    const missingFields = await requestJson(`${baseUrl}/api/content/article`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({})
    });

    assert.equal(missingFields.status, 400);
    assert.deepEqual(missingFields.body, {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request body must include a "fields" object'
      }
    });
  } finally {
    await server.stop();
  }
});

test('content api create returns 400 when entry payload fails schema validation', async () => {
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

    const invalidSchema = await requestJson(`${baseUrl}/api/content/article`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          title: 42
        }
      })
    });

    assert.equal(invalidSchema.status, 400);
    assert.deepEqual(invalidSchema.body, {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid type for field "title" on content type "article": expected string, received number'
      }
    });
  } finally {
    await server.stop();
  }
});


test('content api create returns 400 for invalid JSON body', async () => {
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
    const response = await fetch(`http://127.0.0.1:${port}/api/content/article`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: '{"fields":'
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid JSON body'
      }
    });
  } finally {
    await server.stop();
  }
});

test('content api updates an entry via PATCH /api/content/:type/:id', async () => {
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
    const created = runtime.contentStore.create('article', { title: 'Before update' });

    const updated = await requestJson(`${baseUrl}/api/content/article/${created.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          title: 'After update'
        }
      })
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.id, created.id);
    assert.equal(updated.body.type, 'article');
    assert.deepEqual(updated.body.fields, { title: 'After update' });
    assert.equal(updated.body.createdAt, created.createdAt.toISOString());
    assert.equal(new Date(updated.body.updatedAt).getTime() >= created.updatedAt.getTime(), true);
  } finally {
    await server.stop();
  }
});

test('content api update returns 404 for unknown entry id', async () => {
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
    const response = await requestJson(`http://127.0.0.1:${port}/api/content/article/not-found`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          title: 'Does not exist'
        }
      })
    });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Entry not found: article/not-found'
      }
    });
  } finally {
    await server.stop();
  }
});

test('content api update returns 404 for unknown content type', async () => {
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
    const response = await requestJson(`http://127.0.0.1:${port}/api/content/missing/entry-id`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          title: 'No type'
        }
      })
    });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Content type not found: missing'
      }
    });
  } finally {
    await server.stop();
  }
});

test('content api update returns 400 when entry payload fails schema validation', async () => {
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

  const created = runtime.contentStore.create('article', { title: 'Before invalid update' });

  const server = createHttpServer({
    runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0
  });

  const { port } = await server.start();

  try {
    const response = await requestJson(`http://127.0.0.1:${port}/api/content/article/${created.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          title: 42
        }
      })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid type for field "title" on content type "article": expected string, received number'
      }
    });
  } finally {
    await server.stop();
  }
});


test('content api deletes an entry via DELETE /api/content/:type/:id', async () => {
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

  const created = runtime.contentStore.create('article', { title: 'To delete' });

  const server = createHttpServer({
    runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const deleted = await requestRaw(`${baseUrl}/api/content/article/${created.id}`, {
      method: 'DELETE'
    });

    assert.equal(deleted.status, 204);
    assert.equal(deleted.body, '');

    const listed = await requestJson(`${baseUrl}/api/content/article`);
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, { entries: [] });
  } finally {
    await server.stop();
  }
});

test('content api delete returns 404 for unknown entry id', async () => {
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
    const response = await requestJson(`http://127.0.0.1:${port}/api/content/article/not-found`, {
      method: 'DELETE'
    });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Entry not found: article/not-found'
      }
    });
  } finally {
    await server.stop();
  }
});

test('content api delete returns 404 for unknown content type', async () => {
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
    const response = await requestJson(`http://127.0.0.1:${port}/api/content/missing/entry-id`, {
      method: 'DELETE'
    });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Content type not found: missing'
      }
    });
  } finally {
    await server.stop();
  }
});
