import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';
import { createTestServer } from './helpers/create-test-server.ts';
import { validateAdminStaticDir } from '../core/bootstrap/startup-invariants.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase147-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const readSessionCookie = (response: Response) => {
  const setCookie = response.headers.get('set-cookie') ?? '';
  return setCookie.split(';')[0];
};

test('phase 147: /admin/login remains reachable in installed mode and redirects active session to /admin', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const loginPage = await fetch(`http://127.0.0.1:${port}/admin/login`, { redirect: 'manual' });
    assert.equal(loginPage.status, 200);

    const loginHtml = await loginPage.text();
    assert.equal(loginHtml.includes('Login · Nimb Admin'), true);

    const login = await fetch(`http://127.0.0.1:${port}/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'admin@nimb.local', password: 'admin' }).toString(),
      redirect: 'manual'
    });

    assert.equal(login.status, 302);
    assert.equal(login.headers.get('location'), '/admin');

    const sessionCookie = readSessionCookie(login);

    const withSession = await fetch(`http://127.0.0.1:${port}/admin/login`, {
      headers: { cookie: sessionCookie },
      redirect: 'manual'
    });

    assert.equal(withSession.status, 302);
    assert.equal(withSession.headers.get('location'), '/admin');
  } finally {
    await server.stop();
  }
});

test('phase 147: /admin/login is guarded before install and installer continuity remains intact', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const guardedLogin = await fetch(`http://127.0.0.1:${listening.port}/admin/login`, { redirect: 'manual' });
    assert.equal(guardedLogin.status, 302);
    assert.equal(guardedLogin.headers.get('location'), '/install');

    const install = await fetch(`http://127.0.0.1:${listening.port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        siteTitle: 'Phase 147 Site',
        adminUser: 'phase147admin',
        adminPassword: 'super-secret-password1',
        adminPasswordConfirm: 'super-secret-password1'
      }),
      redirect: 'manual'
    });

    assert.equal(install.status, 302);
    assert.equal(install.headers.get('location'), '/admin/login?welcome=1');

    const welcomeLogin = await fetch(`http://127.0.0.1:${listening.port}/admin/login?welcome=1`);
    const welcomeHtml = await welcomeLogin.text();
    assert.equal(welcomeLogin.status, 200);
    assert.equal(welcomeHtml.includes('name="next" value="/admin?welcome=1"'), true);

    const afterInstallPage = await fetch(`http://127.0.0.1:${listening.port}/install`, { redirect: 'manual' });
    assert.equal(afterInstallPage.status, 302);
    assert.equal(afterInstallPage.headers.get('location'), '/admin/login?install=complete');
  } finally {
    await started.server.stop();
  }
});

test('phase 147: login next redirect is deterministic and logout clears access', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const unsafeNextLogin = await fetch(`http://127.0.0.1:${port}/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'admin@nimb.local', password: 'admin', next: 'https://example.com' }).toString(),
      redirect: 'manual'
    });

    assert.equal(unsafeNextLogin.status, 302);
    assert.equal(unsafeNextLogin.headers.get('location'), '/admin');

    const sessionCookie = readSessionCookie(unsafeNextLogin);

    const logout = await fetch(`http://127.0.0.1:${port}/admin/logout`, {
      method: 'POST',
      headers: { cookie: sessionCookie },
      redirect: 'manual'
    });

    assert.equal(logout.status, 302);
    assert.equal(logout.headers.get('location'), '/admin/login?logged_out=1');

    const blocked = await fetch(`http://127.0.0.1:${port}/admin`, {
      headers: { cookie: sessionCookie },
      redirect: 'manual'
    });

    assert.equal(blocked.status, 302);
    assert.equal(blocked.headers.get('location'), '/admin/login');
  } finally {
    await server.stop();
  }
});

test('phase 147: admin app fallback works when project admin static directories are absent', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    fs.rmSync(path.join(cwd, 'admin'), { recursive: true, force: true });
    fs.rmSync(path.join(cwd, 'public', 'admin'), { recursive: true, force: true });

    const assetResponse = await fetch(`http://127.0.0.1:${port}/admin/app.js`);
    assert.equal(assetResponse.status, 200);

    const assetBody = await assetResponse.text();
    assert.equal(assetBody.includes('bootstrapLayout'), true);
  } finally {
    await server.stop();
  }
});

test('phase 147: default admin static directory is optional when not explicitly configured', () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  assert.doesNotThrow(() => {
    validateAdminStaticDir({ admin: { enabled: true } }, cwd);
  });

  assert.throws(() => {
    validateAdminStaticDir({ admin: { enabled: true, staticDir: './missing-admin-static' } }, cwd);
  }, /admin staticDir does not exist/);
});
