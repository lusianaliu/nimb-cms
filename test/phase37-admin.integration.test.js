import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase37-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
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

test('phase 37: deterministic admin control api', async () => {
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

    const unauth = await postJson(`${baseUrl}/api/admin/runtime/persist`, {});
    assert.equal(unauth.status, 401);
    assert.equal(unauth.body.success, false);

    const login = await postJson(`${baseUrl}/api/auth/login`, { username: 'admin', password: 'admin' });
    const token = login.body.data.session.token;

    const headers = { authorization: `Bearer ${token}`, 'x-request-id': 'phase37-command-1' };
    const persistFirst = await postJson(`${baseUrl}/api/admin/runtime/persist`, { source: 'test' }, headers);
    const persistReplay = await postJson(`${baseUrl}/api/admin/runtime/persist`, { source: 'test' }, headers);

    assert.equal(persistFirst.status, 200);
    assert.deepEqual(persistFirst.body, persistReplay.body);
    assert.equal(persistFirst.body.data.command.result.success, true);

    const reconcile = await postJson(`${baseUrl}/api/admin/goals/reconcile`, {}, { authorization: `Bearer ${token}`, 'x-request-id': 'phase37-command-2' });
    assert.equal(reconcile.status, 200);
    assert.equal(reconcile.body.data.command.result.success, true);

    const status = await getJson(`${baseUrl}/api/admin/status`, { authorization: `Bearer ${token}` });
    assert.equal(status.status, 200);
    assert.equal(status.body.data.admin.commandHistory.length >= 2, true);
    assert.equal(status.body.data.admin.lastCommands.length >= 2, true);
    assert.equal(status.body.data.admin.adminHealth, 'ok');

    const inspector = await getJson(`${baseUrl}/inspector`);
    assert.equal(inspector.status, 200);
    assert.equal(inspector.body.admin.commandHistory.length >= 2, true);
    assert.equal(inspector.body.admin.adminHealth, 'ok');

    const persisted = fs.readFileSync(path.join(cwd, '.nimb', 'runtime.json'), 'utf8');
    const persistedAfterReplay = fs.readFileSync(path.join(cwd, '.nimb', 'runtime.json'), 'utf8');
    assert.equal(persistedAfterReplay, persisted);
  } finally {
    await server.stop();
  }
});
