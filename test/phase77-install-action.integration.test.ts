import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase77-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
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

test('phase 77: POST /install marks setup state and returns installed status', async () => {
  await withInstallState(async () => {
    fs.rmSync(INSTALL_STATE_PATH, { force: true });

    const cwd = mkdtemp();
    writeConfig(cwd);

    const { server, port } = await createServer(cwd);

    try {
      const response = await fetch(`http://127.0.0.1:${port}/install`, { method: 'POST' });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        status: 'installed',
        rebootRequired: true
      });

      assert.equal(fs.existsSync(INSTALL_STATE_PATH), true);
      const installState = JSON.parse(fs.readFileSync(INSTALL_STATE_PATH, 'utf8'));
      assert.equal(installState.version, '0.1.0');
      assert.equal(Number.isNaN(Date.parse(installState.installedAt)), false);
    } finally {
      await server.stop();
    }
  });
});

test('phase 77: second POST /install returns 409 when already installed', async () => {
  await withInstallState(async () => {
    fs.rmSync(INSTALL_STATE_PATH, { force: true });

    const cwd = mkdtemp();
    writeConfig(cwd);

    const { server, port } = await createServer(cwd);

    try {
      const first = await fetch(`http://127.0.0.1:${port}/install`, { method: 'POST' });
      assert.equal(first.status, 200);

      const second = await fetch(`http://127.0.0.1:${port}/install`, { method: 'POST' });
      assert.equal(second.status, 409);
      assert.deepEqual(await second.json(), {
        error: 'Already installed'
      });
    } finally {
      await server.stop();
    }
  });
});
