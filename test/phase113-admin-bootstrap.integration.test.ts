import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer } from './helpers/create-test-server.ts';

const USERS_PATH = '/data/users.json';
const INSTALL_STATE_PATH = '/data/system/install.json';
const SESSIONS_PATH = '/data/system/sessions.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase113-'));

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

test('phase 113: installer bootstraps admin user and redirects to admin setup', async () => {
  await withSystemAuthState(async () => {
    const cwd = mkdtemp();
    writeConfig(cwd);

    const { server } = await createTestServer({ cwd });
    const started = await server.start();

    try {
      const installPage = await fetch(`http://127.0.0.1:${started.port}/install`, { redirect: 'manual' });
      assert.equal(installPage.status, 200);

      const installResponse = await fetch(`http://127.0.0.1:${started.port}/install`, {
        method: 'POST',
        redirect: 'manual'
      });

      assert.equal(installResponse.status, 302);
      assert.equal(installResponse.headers.get('location'), '/admin/setup');
      assert.match(installResponse.headers.get('set-cookie') ?? '', /^nimb_admin_session=/);

      assert.equal(fs.existsSync(USERS_PATH), true);
      assert.equal(fs.existsSync(INSTALL_STATE_PATH), true);

      const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')) as Array<Record<string, unknown>>;
      assert.equal(users.length > 0, true);
      assert.equal(users[0]?.username, 'admin');
      assert.equal(users[0]?.email, 'admin@nimb.local');
      assert.equal(typeof users[0]?.passwordHash, 'string');
      assert.match(`${users[0]?.passwordHash ?? ''}`, /^scrypt\$/);

      const installState = JSON.parse(fs.readFileSync(INSTALL_STATE_PATH, 'utf8')) as Record<string, unknown>;
      assert.equal(installState.installed, true);
      assert.equal(Number.isNaN(Date.parse(`${installState.installedAt ?? ''}`)), false);

      const setupWithSession = await fetch(`http://127.0.0.1:${started.port}/admin`, {
        redirect: 'manual',
        headers: { cookie: (installResponse.headers.get('set-cookie') ?? '').split(';')[0] }
      });
      assert.equal(setupWithSession.status, 302);
      assert.equal(setupWithSession.headers.get('location'), '/admin/setup');
    } finally {
      await server.stop();
    }
  });
});
