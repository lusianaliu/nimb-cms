import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';
import { saveSystemConfig } from '../core/system/system-config.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase105-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const writeProjectInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '105.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const withSystemInstallFiles = async (run: () => Promise<void> | void) => {
  const previousInstall = fs.existsSync(INSTALL_STATE_PATH)
    ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8')
    : null;

  try {
    await run();
  } finally {
    if (previousInstall === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousInstall, 'utf8');
    }
  }
};

const createServer = async (cwd: string) => {
  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
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

test('phase 105: install-state guard blocks runtime routes until installed config is true', async () => {
  await withSystemInstallFiles(async () => {
    markInstalled({ version: '105.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeProjectInstallState(cwd);

    fs.rmSync(path.join(cwd, 'data', 'system', 'config.json'), { force: true });

    let started = await createServer(cwd);

    try {
      const rootBlocked = await fetch(`http://127.0.0.1:${started.port}/`, { redirect: 'manual' });
      assert.equal(rootBlocked.status, 302);
      assert.equal(rootBlocked.headers.get('location'), '/install');

      const adminBlocked = await fetch(`http://127.0.0.1:${started.port}/admin`, { redirect: 'manual' });
      assert.equal(adminBlocked.status, 302);
      assert.equal(adminBlocked.headers.get('location'), '/install');

      const installAllowed = await fetch(`http://127.0.0.1:${started.port}/install`, { redirect: 'manual' });
      assert.equal(installAllowed.status, 200);
    } finally {
      await started.server.stop();
    }

    saveSystemConfig({
      installed: true,
      version: '105.0.0',
      installedAt: '2026-01-01T00:00:00.000Z'
    }, { projectRoot: cwd });
    fs.mkdirSync(path.join(cwd, 'data'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'data', 'install.lock'), 'installed\n', 'utf8');

    started = await createServer(cwd);

    try {
      const rootAllowed = await fetch(`http://127.0.0.1:${started.port}/`, { redirect: 'manual' });
      assert.notEqual(rootAllowed.status, 302);
      assert.notEqual(rootAllowed.headers.get('location'), '/install');
    } finally {
      await started.server.stop();
    }
  });
});
