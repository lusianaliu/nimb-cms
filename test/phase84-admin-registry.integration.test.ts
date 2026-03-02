import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase84-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '84.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const withInstallState = async (run: () => Promise<void> | void) => {
  const previousContent = fs.existsSync(INSTALL_STATE_PATH)
    ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8')
    : null;

  try {
    await run();
  } finally {
    if (previousContent === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousContent, 'utf8');
    }
  }
};

const createServer = async (cwd: string) => {
  const bootstrap = await createBootstrap({ cwd });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0,
    rootDirectory: cwd
  });

  const { port } = await server.start();
  return { bootstrap, server, port };
};

test('phase 84: admin extension registry exposes default page and admin page list API', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '84.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const { bootstrap, server, port } = await createServer(cwd);

    try {
      assert.deepEqual(bootstrap.runtime.adminRegistry.getAdminPages(), [
        { id: 'dashboard', path: '/admin', title: 'Dashboard' }
      ]);

      const pagesResponse = await fetch(`http://127.0.0.1:${port}/admin-api/pages`);
      assert.equal(pagesResponse.status, 200);
      assert.equal(pagesResponse.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.deepEqual(await pagesResponse.json(), [
        { id: 'dashboard', path: '/admin', title: 'Dashboard' }
      ]);

      const appScriptResponse = await fetch(`http://127.0.0.1:${port}/admin/app.js`);
      assert.equal(appScriptResponse.status, 200);

      const appScript = await appScriptResponse.text();
      assert.equal(appScript.includes('Welcome to Nimb'), true);
      assert.equal(appScript.includes('Installation successful'), true);
      assert.equal(appScript.includes("fetch('/admin-api/system/info')"), true);
    } finally {
      await server.stop();
    }
  });
});
