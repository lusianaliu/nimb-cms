import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase38-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
};

const getText = async (url) => {
  const response = await fetch(url);
  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get('content-type')
  };
};

const getJson = async (url, headers = {}) => {
  const response = await fetch(url, { headers });
  return {
    status: response.status,
    body: await response.json()
  };
};

const postJson = async (url, body, headers = {}) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });

  return {
    status: response.status,
    body: await response.json()
  };
};

const runAdminUiAssertions = async ({ baseUrl, adminBasePath }) => {
  const adminRoot = await getText(`${baseUrl}${adminBasePath}`);
  assert.equal(adminRoot.status, 200);
  assert.equal(adminRoot.contentType, 'text/html; charset=utf-8');
  assert.equal(adminRoot.body.includes('Nimb Admin Login'), true);
  assert.equal(adminRoot.body.includes('Content Management'), true);
  assert.equal(adminRoot.body.includes('Entries'), true);

  const adminScript = await getText(`${baseUrl}${adminBasePath}/login.js`);
  assert.equal(adminScript.status, 200);
  assert.equal(adminScript.contentType, 'application/javascript; charset=utf-8');
  assert.equal(adminScript.body.includes('apiClient.login'), true);

  const dashboardScript = await getText(`${baseUrl}${adminBasePath}/dashboard.js`);
  assert.equal(dashboardScript.status, 200);
  assert.equal(dashboardScript.body.includes('publish'), true);
  assert.equal(dashboardScript.body.includes('archive'), true);
  assert.equal(dashboardScript.body.includes('draft'), true);

  const login = await postJson(`${baseUrl}/api/auth/login`, { username: 'admin', password: 'admin' });
  assert.equal(login.status, 200);
  assert.equal(login.body.success, true);

  const token = login.body.data.session.token;
  const adminStatus = await getJson(`${baseUrl}/api/admin/status`, { authorization: `Bearer ${token}` });
  assert.equal(adminStatus.status, 200);
  assert.equal(adminStatus.body.success, true);

  const runtime = await getJson(`${baseUrl}/api/runtime`, { authorization: `Bearer ${token}` });
  assert.equal(runtime.status, 200);
  assert.equal(runtime.body.success, true);
};

test('phase 38: deterministic admin ui is served and uses auth api', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const bootstrap = await createBootstrap({ cwd, startupTimestamp });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0,
    clock: () => '2026-01-01T00:00:10.000Z',
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await runAdminUiAssertions({ baseUrl, adminBasePath: bootstrap.config.admin.basePath });
  } finally {
    await server.stop();
  }
});

test('phase 38: admin ui mount path is configuration-driven', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, {
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { basePath: '/dashboard' }
  });

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const bootstrap = await createBootstrap({ cwd, startupTimestamp });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0,
    clock: () => '2026-01-01T00:00:10.000Z',
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const oldPath = await getText(`${baseUrl}/admin`);
    assert.equal(oldPath.status, 404);
    await runAdminUiAssertions({ baseUrl, adminBasePath: bootstrap.config.admin.basePath });
  } finally {
    await server.stop();
  }
});
