import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase58-'));

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

test('phase 58: installer mode redirects /admin to /install', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3270);

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/install');
  } finally {
    await server.stop();
  }
});

test('phase 58: normal mode returns admin bootstrap HTML at /admin', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3271);
  writeInstallState(cwd, '2.0.0');

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/admin`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');

    const html = await response.text();
    assert.equal(html.includes('<title>Nimb Admin</title>'), true);
    assert.equal(html.includes('<h1>Nimb Admin</h1>'), true);
    assert.equal(html.includes('<p>Site is ready.</p>'), true);
  } finally {
    await server.stop();
  }
});

test('phase 58: admin bootstrap endpoint remains cwd-independent', async () => {
  const workspaceRoot = mkdtemp();
  const firstProjectRoot = path.join(workspaceRoot, 'site-a');
  const secondProjectRoot = path.join(workspaceRoot, 'site-b');
  fs.mkdirSync(firstProjectRoot, { recursive: true });
  fs.mkdirSync(secondProjectRoot, { recursive: true });
  writeConfig(firstProjectRoot, 3272);
  writeConfig(secondProjectRoot, 3273);
  writeInstallState(firstProjectRoot, '2.0.0');

  const originalCwd = process.cwd();
  process.chdir(secondProjectRoot);

  let server;

  try {
    const started = await createServer(firstProjectRoot);
    server = started.server;

    const response = await fetch(`http://127.0.0.1:${started.port}/admin`);
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.equal(html.includes('<h1>Nimb Admin</h1>'), true);
  } finally {
    process.chdir(originalCwd);

    if (server) {
      await server.stop();
    }
  }
});

test('phase 58: admin bootstrap endpoint persists across restart', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3274);

  const started = await createServer(cwd);

  try {
    const installResponse = await fetch(`http://127.0.0.1:${started.port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(installResponse.status, 200);
  } finally {
    await started.server.stop();
  }

  const restarted = await createServer(cwd);
  try {
    const response = await fetch(`http://127.0.0.1:${restarted.port}/admin`);
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.equal(html.includes('<title>Nimb Admin</title>'), true);
    assert.equal(html.includes('<h1>Nimb Admin</h1>'), true);
    assert.equal(html.includes('<p>Site is ready.</p>'), true);
  } finally {
    await restarted.server.stop();
  }
});
