import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase56-'));

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

test('phase 56: GET /install returns HTML in installer mode', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3260);

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/install`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');

    const body = await response.text();
    assert.match(body, /<title>Nimb Setup<\/title>/);
  } finally {
    await server.stop();
  }
});

test('phase 56: GET /install returns 404 in normal mode', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3261);
  writeInstallState(cwd, '2.0.0');

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/install`);
    assert.equal(response.status, 404);
  } finally {
    await server.stop();
  }
});

test('phase 56: installer HTML contains install trigger', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3262);

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/install`);
    const body = await response.text();

    assert.match(body, /Install/);
    assert.match(body, /fetch\('\/install', \{ method: 'POST' \}\)/);
    assert.match(body, /Installation completed\. Restart server\./);
  } finally {
    await server.stop();
  }
});

test('phase 56: installer UI route remains cwd-independent', async () => {
  const workspaceRoot = mkdtemp();
  const firstProjectRoot = path.join(workspaceRoot, 'site-a');
  const secondProjectRoot = path.join(workspaceRoot, 'site-b');
  fs.mkdirSync(firstProjectRoot, { recursive: true });
  fs.mkdirSync(secondProjectRoot, { recursive: true });
  writeConfig(firstProjectRoot, 3263);
  writeConfig(secondProjectRoot, 3264);
  writeInstallState(secondProjectRoot, '3.0.0');

  const originalCwd = process.cwd();
  process.chdir(secondProjectRoot);

  let server;

  try {
    const started = await createServer(firstProjectRoot);
    server = started.server;

    const response = await fetch(`http://127.0.0.1:${started.port}/install`, { redirect: 'manual' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  } finally {
    process.chdir(originalCwd);

    if (server) {
      await server.stop();
    }
  }
});
