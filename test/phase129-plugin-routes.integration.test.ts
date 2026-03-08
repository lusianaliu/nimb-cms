import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer } from './helpers/create-test-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase129-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const systemDir = path.join(cwd, 'data', 'system');
  fs.mkdirSync(systemDir, { recursive: true });
  fs.writeFileSync(path.join(systemDir, 'config.json'), `${JSON.stringify({ installed: true, version: '129.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
  fs.writeFileSync(path.join(cwd, 'data', 'install.lock'), 'installed\n');
};

const writePlugin = (cwd: string) => {
  const pluginDirectory = path.join(cwd, 'plugins', 'route-plugin');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'plugin.json'), `${JSON.stringify({
    name: 'route-plugin',
    version: '1.0.0',
    main: 'index.ts'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(pluginDirectory, 'index.ts'), `
    export function activate(runtime) {
      runtime.hooks.registerHook('routes.register', (router) => {
        router.registerRoute('GET', '/hello-plugin', (req, res) => {
          res.end('Hello from plugin');
        });

        router.registerRoute('POST', '/hello-plugin', (req, res) => {
          res.end('POST from plugin');
        });

        router.registerRoute('PUT', '/hello-plugin', (req, res) => {
          res.end('PUT from plugin');
        });

        router.registerRoute('DELETE', '/hello-plugin', (req, res) => {
          res.end('DELETE from plugin');
        });

        router.registerRoute('GET', '/hello-plugin-error', () => {
          throw new Error('plugin route failed');
        });
      });
    }
  `);
};

test('phase 129: plugin registers routes via routes.register hook and responds for supported methods', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  writePlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const getResponse = await fetch(`http://127.0.0.1:${listening.port}/hello-plugin`);
    assert.equal(getResponse.status, 200);
    assert.equal(await getResponse.text(), 'Hello from plugin');

    const postResponse = await fetch(`http://127.0.0.1:${listening.port}/hello-plugin`, { method: 'POST' });
    assert.equal(postResponse.status, 200);
    assert.equal(await postResponse.text(), 'POST from plugin');

    const putResponse = await fetch(`http://127.0.0.1:${listening.port}/hello-plugin`, { method: 'PUT' });
    assert.equal(putResponse.status, 200);
    assert.equal(await putResponse.text(), 'PUT from plugin');

    const deleteResponse = await fetch(`http://127.0.0.1:${listening.port}/hello-plugin`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    assert.equal(await deleteResponse.text(), 'DELETE from plugin');
  } finally {
    await started.server.stop();
  }
});

test('phase 129: plugin route error is isolated and does not crash server', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  writePlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const failingResponse = await fetch(`http://127.0.0.1:${listening.port}/hello-plugin-error`);
    assert.equal(failingResponse.status, 500);

    const body = await failingResponse.json();
    assert.equal(body?.error?.code, 'PLUGIN_ROUTE_FAILURE');

    const stillRunningResponse = await fetch(`http://127.0.0.1:${listening.port}/hello-plugin`);
    assert.equal(stillRunningResponse.status, 200);
    assert.equal(await stillRunningResponse.text(), 'Hello from plugin');
  } finally {
    await started.server.stop();
  }
});
