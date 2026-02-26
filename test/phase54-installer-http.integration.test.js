import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase54-'));

const writeConfig = (cwd, port) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd, version = '1.0.0') => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version, installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const createServer = async (cwd, bootstrapOptions = {}) => {
  const bootstrap = await createBootstrap({ cwd, ...bootstrapOptions });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0
  });

  const { port } = await server.start();
  return { server, port };
};

test('phase 54: installer mode serves install response at root', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3240);

  const { server, port } = await createServer(cwd, { mode: 'install' });

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'install',
      message: 'Nimb is not installed'
    });
  } finally {
    await server.stop();
  }
});

test('phase 54: installer mode does not mount /install page route', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3241);

  const { server, port } = await createServer(cwd, { mode: 'install' });

  try {
    const response = await fetch(`http://127.0.0.1:${port}/install`, { redirect: 'manual' });
    assert.equal(response.status, 404);
  } finally {
    await server.stop();
  }
});

test('phase 54: normal mode preserves existing routing behavior', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3242);
  writeInstallState(cwd, '2.0.0');

  const { server, port } = await createServer(cwd, { mode: 'runtime' });

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { redirect: 'manual' });
    assert.equal(response.status, 200);
  } finally {
    await server.stop();
  }
});

test('phase 54: install router remains cwd-independent', async () => {
  const workspaceRoot = mkdtemp();
  const firstProjectRoot = path.join(workspaceRoot, 'site-a');
  const secondProjectRoot = path.join(workspaceRoot, 'site-b');
  fs.mkdirSync(firstProjectRoot, { recursive: true });
  fs.mkdirSync(secondProjectRoot, { recursive: true });
  writeConfig(firstProjectRoot, 3243);
  writeConfig(secondProjectRoot, 3244);

  const originalCwd = process.cwd();
  process.chdir(secondProjectRoot);

  let server;

  try {
    const started = await createServer(firstProjectRoot, { mode: 'install' });
    server = started.server;

    const response = await fetch(`http://127.0.0.1:${started.port}/runtime`, { redirect: 'manual' });
    assert.equal(response.status, 404);
  } finally {
    process.chdir(originalCwd);

    if (server) {
      await server.stop();
    }
  }
});
