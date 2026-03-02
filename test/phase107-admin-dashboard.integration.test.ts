import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';
import { createTestServer } from './helpers/create-test-server.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const USERS_PATH = '/data/system/users.json';
const SESSIONS_PATH = '/data/system/sessions.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase107-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '107.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const withInstallState = async (run: () => Promise<void> | void) => {
  const previousInstall = fs.existsSync(INSTALL_STATE_PATH) ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8') : null;
  const previousUsers = fs.existsSync(USERS_PATH) ? fs.readFileSync(USERS_PATH, 'utf8') : null;
  const previousSessions = fs.existsSync(SESSIONS_PATH) ? fs.readFileSync(SESSIONS_PATH, 'utf8') : null;

  try {
    fs.rmSync(SESSIONS_PATH, { force: true });
    await run();
  } finally {
    if (previousInstall === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousInstall, 'utf8');
    }

    if (previousUsers === null) {
      fs.rmSync(USERS_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
      fs.writeFileSync(USERS_PATH, previousUsers, 'utf8');
    }

    if (previousSessions === null) {
      fs.rmSync(SESSIONS_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(SESSIONS_PATH), { recursive: true });
      fs.writeFileSync(SESSIONS_PATH, previousSessions, 'utf8');
    }
  }
};

test('phase 107: admin dashboard renders after login in installed mode and exposes system info', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '107.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const { server, port } = await createInstalledServer({ cwd });

    try {
      const blocked = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
      assert.equal(blocked.status, 302);
      assert.equal(blocked.headers.get('location'), '/admin/login');

      const successLogin = await fetch(`http://127.0.0.1:${port}/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email: 'admin@nimb.local', password: 'admin' }).toString(),
        redirect: 'manual'
      });

      assert.equal(successLogin.status, 302);
      assert.equal(successLogin.headers.get('location'), '/admin');

      const sessionCookie = (successLogin.headers.get('set-cookie') ?? '').split(';')[0];
      const dashboard = await fetch(`http://127.0.0.1:${port}/admin`, {
        headers: { cookie: sessionCookie }
      });

      assert.equal(dashboard.status, 200);
      const html = await dashboard.text();
      assert.equal(html.includes('<div id="admin-root"></div>'), true);

      const systemInfo = await fetch(`http://127.0.0.1:${port}/admin-api/system/info`);
      assert.equal(systemInfo.status, 200);
      assert.equal(systemInfo.headers.get('content-type'), 'application/json; charset=utf-8');
      const payload = await systemInfo.json();
      assert.equal(payload.siteName, 'My Nimb Site');
      assert.equal(typeof payload.version, 'string');
      assert.equal(payload.version.length > 0, true);
      assert.equal(payload.installedAt === null || Number.isNaN(Date.parse(String(payload.installedAt))) === false, true);
    } finally {
      await server.stop();
    }
  });
});

test('phase 107: installer mode does not expose admin dashboard', async () => {
  await withInstallState(async () => {
    const cwd = mkdtemp();
    writeConfig(cwd);

    const started = await createTestServer({ cwd });
    const { server } = started;
    const { port } = await server.start();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), '/install');
    } finally {
      await server.stop();
    }
  });
});
