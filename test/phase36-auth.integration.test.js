import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase36-'));

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

test('phase 36: deterministic auth and sessions', async () => {
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
    authMiddleware: bootstrap.authMiddleware
  });

  const { port } = await server.start();

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const login = await postJson(`${baseUrl}/api/auth/login`, { username: 'admin', password: 'admin' });
    assert.equal(login.status, 200);
    assert.equal(login.body.success, true);
    assert.equal(typeof login.body.data.session.token, 'string');

    const token = login.body.data.session.token;

    const validSession = await getJson(`${baseUrl}/api/auth/session`, { authorization: `Bearer ${token}` });
    assert.equal(validSession.status, 200);
    assert.equal(validSession.body.success, true);
    assert.equal(validSession.body.data.session.user.username, 'admin');

    const invalidSession = await getJson(`${baseUrl}/api/auth/session`, { authorization: 'Bearer invalid.token' });
    assert.equal(invalidSession.status, 401);
    assert.equal(invalidSession.body.success, false);

    const inspector = await getJson(`${baseUrl}/inspector`);
    assert.equal(inspector.status, 200);
    assert.equal(inspector.body.auth.activeSessions, 1);
    assert.equal(inspector.body.auth.users[0].username, 'admin');
    assert.equal(inspector.body.auth.authHealth, 'ok');
  } finally {
    await server.stop();
  }

  const firstAuthFile = fs.readFileSync(path.join(cwd, '.nimb', 'auth.json'), 'utf8');

  const restarted = await createBootstrap({ cwd, startupTimestamp });
  const restartedServer = createHttpServer({
    runtime: restarted.runtime,
    config: restarted.config,
    startupTimestamp,
    port: 0,
    clock: () => '2026-01-01T00:00:10.000Z',
    authService: restarted.authService,
    authMiddleware: restarted.authMiddleware
  });

  const restartedPort = (await restartedServer.start()).port;

  try {
    const baseUrl = `http://127.0.0.1:${restartedPort}`;

    const restored = await getJson(`${baseUrl}/api/auth/session`, { authorization: `Bearer ${JSON.parse(firstAuthFile).payload.sessions[0].token}` });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.success, true);

    const secondAuthFile = fs.readFileSync(path.join(cwd, '.nimb', 'auth.json'), 'utf8');
    assert.equal(secondAuthFile, firstAuthFile);
  } finally {
    await restartedServer.stop();
  }
});
