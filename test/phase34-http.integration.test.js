import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase34-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
};

const getJson = async (url) => {
  const response = await fetch(url);
  return {
    status: response.status,
    body: await response.json()
  };
};

test('phase 34: deterministic http endpoints', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const fixedClock = () => '2026-01-01T00:00:10.000Z';

  const bootstrap = await createBootstrap({ cwd, startupTimestamp });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0,
    clock: fixedClock
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const health = await getJson(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { status: 'ok' });

    const runtimeFirst = await getJson(`${baseUrl}/runtime`);
    const runtimeSecond = await getJson(`${baseUrl}/runtime`);
    assert.equal(runtimeFirst.status, 200);
    assert.equal(runtimeFirst.body.mode, 'development');
    assert.equal(Array.isArray(runtimeFirst.body.plugins), true);
    assert.equal(runtimeFirst.body.plugins.length > 0, true);
    assert.equal(runtimeFirst.body.uptime, 10000);
    assert.deepEqual(runtimeFirst.body, runtimeSecond.body);

    const inspectorFirst = await getJson(`${baseUrl}/inspector`);
    const inspectorSecond = await getJson(`${baseUrl}/inspector`);
    assert.equal(inspectorFirst.status, 200);
    assert.deepEqual(inspectorFirst.body, inspectorSecond.body);
    assert.deepEqual(Object.keys(inspectorFirst.body), ['admin', 'auth', 'goals', 'orchestrator', 'persistence', 'state']);

    const missing = await getJson(`${baseUrl}/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found: /missing'
      },
      timestamp: '2026-01-01T00:00:10.000Z'
    });
  } finally {
    await server.stop();
  }
});
