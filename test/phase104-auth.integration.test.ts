import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const USERS_PATH = '/data/system/users.json';
const SESSIONS_PATH = '/data/system/sessions.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase104-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '104.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const withInstallState = async (run: () => Promise<void> | void) => {
  const previousInstall = fs.existsSync(INSTALL_STATE_PATH)
    ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8')
    : null;
  const previousUsers = fs.existsSync(USERS_PATH)
    ? fs.readFileSync(USERS_PATH, 'utf8')
    : null;
  const previousSessions = fs.existsSync(SESSIONS_PATH)
    ? fs.readFileSync(SESSIONS_PATH, 'utf8')
    : null;

  try {
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

const createServer = async (cwd: string) => {
  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0,
    rootDirectory: cwd
  });

  const { port } = await server.start();
  return { server, port };
};

test('phase 104: admin auth login, middleware guard, session persistence, and logout', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '104.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const { server, port } = await createServer(cwd);

    try {
      const blocked = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
      assert.equal(blocked.status, 302);
      assert.equal(blocked.headers.get('location'), '/admin/login');

      const failedLogin = await fetch(`http://127.0.0.1:${port}/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email: 'admin@nimb.local', password: 'wrong' }).toString(),
        redirect: 'manual'
      });
      assert.equal(failedLogin.status, 401);

      const successLogin = await fetch(`http://127.0.0.1:${port}/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email: 'admin@nimb.local', password: 'admin' }).toString(),
        redirect: 'manual'
      });

      assert.equal(successLogin.status, 302);
      assert.equal(successLogin.headers.get('location'), '/admin');

      const sessionCookie = successLogin.headers.get('set-cookie') ?? '';
      assert.match(sessionCookie, /^nimb_admin_session=/);
      assert.match(sessionCookie, /HttpOnly/i);
      assert.match(sessionCookie, /Path=\//);

      const sessions = JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf8')) as Array<Record<string, unknown>>;
      assert.equal(sessions.length > 0, true);
      assert.equal(typeof sessions[0]?.id, 'string');
      assert.equal(typeof sessions[0]?.userId, 'string');

      const authCookie = sessionCookie.split(';')[0];
      const allowed = await fetch(`http://127.0.0.1:${port}/admin`, {
        headers: { cookie: authCookie }
      });
      assert.equal(allowed.status, 200);

      const logout = await fetch(`http://127.0.0.1:${port}/admin/logout`, {
        method: 'POST',
        headers: { cookie: authCookie },
        redirect: 'manual'
      });
      assert.equal(logout.status, 302);
      assert.equal(logout.headers.get('location'), '/admin/login');
      assert.match(logout.headers.get('set-cookie') ?? '', /nimb_admin_session=;/);

      const sessionsAfterLogout = JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf8')) as Array<Record<string, unknown>>;
      assert.equal(sessionsAfterLogout.length, 0);
    } finally {
      await server.stop();
    }
  });
});
