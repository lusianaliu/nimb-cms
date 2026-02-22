import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase35-'));

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

test('phase 35: deterministic api endpoints', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const bootstrap = await createBootstrap({ cwd, startupTimestamp });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0,
    clock: () => '2026-01-01T00:00:10.000Z'
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const endpoints = ['/api/system', '/api/runtime', '/api/goals', '/api/persistence'];

    for (const endpoint of endpoints) {
      const first = await getJson(`${baseUrl}${endpoint}`);
      const second = await getJson(`${baseUrl}${endpoint}`);

      assert.equal(first.status, 200);
      assert.deepEqual(first.body, second.body);
      assert.equal(first.body.success, true);
      assert.deepEqual(Object.keys(first.body), ['data', 'meta', 'success']);
      assert.equal(typeof first.body.data, 'object');
      assert.equal(typeof first.body.meta, 'object');
    }

    const missing = await getJson(`${baseUrl}/api/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'API route not found: /api/missing'
      },
      success: false
    });

    const publicRoute = await getJson(`${baseUrl}/runtime`);
    assert.equal(publicRoute.status, 200);
    assert.equal(publicRoute.body.mode, 'development');
  } finally {
    await server.stop();
  }
});
