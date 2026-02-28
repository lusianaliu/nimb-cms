import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase85-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '85.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
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
  return { server, port };
};

test('phase 85: admin shell exposes layout slots and admin-api remains available', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '85.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const { server, port } = await createServer(cwd);

    try {
      const adminResponse = await fetch(`http://127.0.0.1:${port}/admin`);
      assert.equal(adminResponse.status, 200);

      const adminHtml = await adminResponse.text();
      assert.equal(adminHtml.includes('id="admin-header"'), true);
      assert.equal(adminHtml.includes('id="admin-sidebar"'), true);
      assert.equal(adminHtml.includes('id="admin-main"'), true);
      assert.equal(adminHtml.includes('id="admin-footer"'), true);

      const systemResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system`);
      assert.equal(systemResponse.status, 200);
      assert.equal(systemResponse.headers.get('content-type'), 'application/json; charset=utf-8');
    } finally {
      await server.stop();
    }
  });
});
