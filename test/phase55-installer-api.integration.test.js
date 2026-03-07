import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase55-'));

const writeConfig = (cwd, port) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

const createServer = async (cwd) => {
  const bootstrap = await createBootstrap({ cwd });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0
  });

  const { port } = await server.start();
  return { server, port };
};

const readInstallState = (cwd) => {
  const installPath = path.join(cwd, 'data', 'system', 'config.json');
  assert.equal(fs.existsSync(installPath), true);
  return JSON.parse(fs.readFileSync(installPath, 'utf8'));
};

const installFormBody = new URLSearchParams({
  adminEmail: 'admin@example.com',
  adminPassword: 'super-secret-password',
  siteName: 'Nimb Site'
});

test('phase 55: installer mode allows POST /install', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3250);

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: installFormBody,
      redirect: 'manual'
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin');
  } finally {
    await server.stop();
  }
});

test('phase 55: POST /install creates install.json', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3251);

  const { server, port } = await createServer(cwd);

  try {
    await fetch(`http://127.0.0.1:${port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: installFormBody,
      redirect: 'manual'
    });

    const installState = readInstallState(cwd);
    assert.equal(installState.installed, true);
    assert.equal(typeof installState.installedAt, 'string');
    assert.equal(typeof installState.version, 'string');
    assert.equal(fs.existsSync(path.join(cwd, 'data', 'install.lock')), true);
  } finally {
    await server.stop();
  }
});

test('phase 55: second POST /install returns 409', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3252);

  const { server, port } = await createServer(cwd);

  try {
    const first = await fetch(`http://127.0.0.1:${port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: installFormBody,
      redirect: 'manual'
    });
    assert.equal(first.status, 302);

    const second = await fetch(`http://127.0.0.1:${port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: installFormBody,
      redirect: 'manual'
    });
    assert.equal(second.status, 404);
  } finally {
    await server.stop();
  }
});

test('phase 55: restart resolves normal mode after installation', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3253);

  const started = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${started.port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: installFormBody,
      redirect: 'manual'
    });
    assert.equal(response.status, 302);
  } finally {
    await started.server.stop();
  }

  const restartedBootstrap = await createBootstrap({ cwd });
  assert.equal(restartedBootstrap.runtime.mode, 'runtime');
});

test('phase 55: installer API remains cwd-independent', async () => {
  const workspaceRoot = mkdtemp();
  const firstProjectRoot = path.join(workspaceRoot, 'site-a');
  const secondProjectRoot = path.join(workspaceRoot, 'site-b');
  fs.mkdirSync(firstProjectRoot, { recursive: true });
  fs.mkdirSync(secondProjectRoot, { recursive: true });
  writeConfig(firstProjectRoot, 3254);
  writeConfig(secondProjectRoot, 3255);

  const originalCwd = process.cwd();
  process.chdir(secondProjectRoot);

  let server;
  let activePort;

  try {
    const started = await createServer(firstProjectRoot);
    server = started.server;
    activePort = started.port;

    const response = await fetch(`http://127.0.0.1:${activePort}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: installFormBody,
      redirect: 'manual'
    });
    assert.equal(response.status, 302);

        assert.equal(fs.existsSync(path.join(firstProjectRoot, 'data', 'install.lock')), true);
    assert.equal(fs.existsSync(path.join(secondProjectRoot, 'data', 'install.lock')), false);
  } finally {
    process.chdir(originalCwd);

    if (server) {
      await server.stop();
    }
  }
});
