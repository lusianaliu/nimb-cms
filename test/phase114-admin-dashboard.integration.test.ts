import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const USERS_PATH = '/data/users.json';
const INSTALL_STATE_PATH = '/data/system/install.json';
const SESSIONS_PATH = '/data/system/sessions.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase114-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const withSystemAuthState = async (run: () => Promise<void> | void) => {
  const previousUsers = fs.existsSync(USERS_PATH) ? fs.readFileSync(USERS_PATH, 'utf8') : null;
  const previousInstall = fs.existsSync(INSTALL_STATE_PATH) ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8') : null;
  const previousSessions = fs.existsSync(SESSIONS_PATH) ? fs.readFileSync(SESSIONS_PATH, 'utf8') : null;

  try {
    fs.rmSync(USERS_PATH, { force: true });
    fs.rmSync(INSTALL_STATE_PATH, { force: true });
    fs.rmSync(SESSIONS_PATH, { force: true });
    await run();
  } finally {
    if (previousUsers === null) {
      fs.rmSync(USERS_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
      fs.writeFileSync(USERS_PATH, previousUsers, 'utf8');
    }

    if (previousInstall === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousInstall, 'utf8');
    }

    if (previousSessions === null) {
      fs.rmSync(SESSIONS_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(SESSIONS_PATH), { recursive: true });
      fs.writeFileSync(SESSIONS_PATH, previousSessions, 'utf8');
    }
  }
};

test('phase 114: admin dashboard skeleton is shown after admin login', async () => {
  await withSystemAuthState(async () => {
    const cwd = mkdtemp();
    writeConfig(cwd);

    const { server, port } = await createInstalledServer({ cwd });

    try {
      const loginResponse = await fetch(`http://127.0.0.1:${port}/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email: 'admin@nimb.local', password: 'admin' }).toString(),
        redirect: 'manual'
      });

      assert.equal(loginResponse.status, 302);
      assert.equal(loginResponse.headers.get('location'), '/admin');

      const sessionCookie = (loginResponse.headers.get('set-cookie') ?? '').split(';')[0];
      assert.equal(sessionCookie.startsWith('nimb_admin_session='), true);

      const dashboardResponse = await fetch(`http://127.0.0.1:${port}/admin`, {
        headers: { cookie: sessionCookie }
      });

      assert.equal(dashboardResponse.status, 200);
      const dashboardHtml = await dashboardResponse.text();

      assert.equal(dashboardHtml.includes('Nimb CMS'), true);
      assert.equal(dashboardHtml.includes('Dashboard'), true);
      assert.equal(dashboardHtml.includes('Pages'), true);
      assert.equal(dashboardHtml.includes('Posts'), true);
      assert.equal(dashboardHtml.includes('Media'), true);
      assert.equal(dashboardHtml.includes('Themes'), true);
      assert.equal(dashboardHtml.includes('Plugins'), true);
      assert.equal(dashboardHtml.includes('Settings'), true);
      assert.equal(dashboardHtml.includes('Welcome to Nimb CMS'), true);
      assert.equal(dashboardHtml.includes('site name:'), true);
      assert.equal(dashboardHtml.includes('version:'), true);
      assert.equal(dashboardHtml.includes('installedAt:'), true);
    } finally {
      await server.stop();
    }
  });
});
