import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase60-'));

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
  return { bootstrap, server, port };
};

test('phase 60: default admin path works and runtime exposes adminBasePath', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const { bootstrap, server, port } = await createServer(cwd);

  try {
    assert.equal(bootstrap.runtime.adminBasePath, '/admin');

    const response = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin/login');
  } finally {
    await server.stop();
  }
});

test('phase 60: custom admin path /panel works', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { basePath: '/panel' });
  writeInstallState(cwd);

  const { bootstrap, server, port } = await createServer(cwd);

  try {
    assert.equal(bootstrap.runtime.adminBasePath, '/panel');

    const oldPath = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
    assert.equal(oldPath.status, 404);

    const panel = await fetch(`http://127.0.0.1:${port}/panel`, { redirect: 'manual' });
    assert.equal(panel.status, 302);
    assert.equal(panel.headers.get('location'), '/panel/login');
  } finally {
    await server.stop();
  }
});

test('phase 60: login redirect respects custom path', async () => {
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

    assert.equal(login.status, 302);
    assert.equal(login.headers.get('location'), '/panel');
  } finally {
    await server.stop();
  }
});

test('phase 60: installer redirect behavior stays correct with custom path', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { basePath: '/panel' });

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/panel`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/install');
  } finally {
    await server.stop();
  }
});

test('phase 60: session cookie path matches adminBasePath', async () => {
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

    assert.equal(login.status, 302);
    assert.match(login.headers.get('set-cookie') ?? '', /; Path=\/panel;/);
  } finally {
    await server.stop();
  }
});
