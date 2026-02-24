import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase59-'));

const writeConfig = (cwd, port) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port },
    admin: { enabled: true, basePath: '/admin' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd, version = '1.0.0') => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version, installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const writeAdminState = (cwd) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'admin.json'), `${JSON.stringify({
    username: 'admin',
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

const loginAndGetCookie = async (port) => {
  const response = await fetch(`http://127.0.0.1:${port}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'admin', password: 'admin' }).toString(),
    redirect: 'manual'
  });

  return {
    status: response.status,
    location: response.headers.get('location'),
    cookie: response.headers.get('set-cookie')
  };
};

test('phase 59: /admin redirects to /admin/login when not authenticated', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3280);
  writeInstallState(cwd);
  writeAdminState(cwd);

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin/login');
  } finally {
    await server.stop();
  }
});

test('phase 59: login success sets nimb_admin_session cookie', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3281);
  writeInstallState(cwd);
  writeAdminState(cwd);

  const { server, port } = await createServer(cwd);

  try {
    const login = await loginAndGetCookie(port);
    assert.equal(login.status, 302);
    assert.equal(login.location, '/admin');
    assert.equal(typeof login.cookie, 'string');
    assert.match(login.cookie ?? '', /^nimb_admin_session=/);
  } finally {
    await server.stop();
  }
});

test('phase 59: authenticated request can access /admin', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3282);
  writeInstallState(cwd);
  writeAdminState(cwd);

  const { server, port } = await createServer(cwd);

  try {
    const login = await loginAndGetCookie(port);
    const cookie = (login.cookie ?? '').split(';')[0];

    const response = await fetch(`http://127.0.0.1:${port}/admin`, {
      headers: { cookie }
    });

    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal(html.includes('<h1>Dashboard</h1>'), true);
  } finally {
    await server.stop();
  }
});

test('phase 59: restarting server clears in-memory sessions', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3283);
  writeInstallState(cwd);
  writeAdminState(cwd);

  const started = await createServer(cwd);
  let cookie;

  try {
    const login = await loginAndGetCookie(started.port);
    cookie = (login.cookie ?? '').split(';')[0];

    const authenticated = await fetch(`http://127.0.0.1:${started.port}/admin`, {
      headers: { cookie }
    });
    assert.equal(authenticated.status, 200);
  } finally {
    await started.server.stop();
  }

  const restarted = await createServer(cwd);
  try {
    const response = await fetch(`http://127.0.0.1:${restarted.port}/admin`, {
      headers: { cookie },
      redirect: 'manual'
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin/login');
  } finally {
    await restarted.server.stop();
  }
});

test('phase 59: admin auth flow remains cwd-independent', async () => {
  const workspaceRoot = mkdtemp();
  const firstProjectRoot = path.join(workspaceRoot, 'site-a');
  const secondProjectRoot = path.join(workspaceRoot, 'site-b');
  fs.mkdirSync(firstProjectRoot, { recursive: true });
  fs.mkdirSync(secondProjectRoot, { recursive: true });

  writeConfig(firstProjectRoot, 3284);
  writeConfig(secondProjectRoot, 3285);
  writeInstallState(firstProjectRoot);
  writeAdminState(firstProjectRoot);

  const originalCwd = process.cwd();
  process.chdir(secondProjectRoot);

  let server;

  try {
    const started = await createServer(firstProjectRoot);
    server = started.server;

    const login = await loginAndGetCookie(started.port);
    const cookie = (login.cookie ?? '').split(';')[0];

    const response = await fetch(`http://127.0.0.1:${started.port}/admin`, {
      headers: { cookie }
    });

    assert.equal(response.status, 200);
  } finally {
    process.chdir(originalCwd);

    if (server) {
      await server.stop();
    }
  }
});
