import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase61-'));

const writeConfig = (cwd, admin = {}) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin
  }, null, 2)}\n`);
};

const writeInstallState = (cwd, version = '1.0.0') => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version, installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const writeAdminState = (cwd, username = 'admin') => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'admin.json'), `${JSON.stringify({
    username,
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
  }, null, 2)}\n`);
};

const createServer = async (cwd) => {
  const bootstrap = await createBootstrap({ cwd });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0,
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController,
    contentRegistry: bootstrap.contentRegistry,
    persistContentTypes: bootstrap.persistContentTypes,
    entryRegistry: bootstrap.entryRegistry,
    persistEntries: bootstrap.persistEntries
  });

  const { port } = await server.start();
  return { server, port };
};

test('phase 61: authenticated admin sees dashboard shell on /admin', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  writeAdminState(cwd);

  const { server, port } = await createServer(cwd);

  try {
    const login = await fetch(`http://127.0.0.1:${port}/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'admin', password: 'admin' }).toString(),
      redirect: 'manual'
    });

    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
    const response = await fetch(`http://127.0.0.1:${port}/admin`, { headers: { cookie } });

    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal(html.includes('<h1>Nimb Admin</h1>'), true);
    assert.equal(html.includes('<p>Dashboard</p>'), true);
    assert.equal(html.includes('Signed in as <strong>admin</strong>.'), true);
    assert.equal(html.includes('<h2 id="dashboard-core-actions">Core actions</h2>'), true);
    assert.equal(html.includes('<h2 id="dashboard-route">Admin route</h2>'), true);
    assert.equal(html.includes('<code>/admin</code>'), true);
  } finally {
    await server.stop();
  }
});

test('phase 61: dashboard route section respects custom admin base path', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { basePath: '/panel' });
  writeInstallState(cwd);
  writeAdminState(cwd);

  const { server, port } = await createServer(cwd);

  try {
    const login = await fetch(`http://127.0.0.1:${port}/panel/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'admin', password: 'admin' }).toString(),
      redirect: 'manual'
    });

    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
    const response = await fetch(`http://127.0.0.1:${port}/panel`, { headers: { cookie } });

    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal(html.includes('<code>/panel</code>'), true);
  } finally {
    await server.stop();
  }
});
