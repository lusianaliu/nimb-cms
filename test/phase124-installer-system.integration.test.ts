import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer } from './helpers/create-test-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase124-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

test('phase 124: first-time installer creates admin account and allows login', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const installPage = await fetch(`http://127.0.0.1:${listening.port}/install`, { redirect: 'manual' });
    assert.equal(installPage.status, 200);

    const installBody = await installPage.text();
    assert.match(installBody, /Admin Email/);
    assert.match(installBody, /Admin Password/);
    assert.match(installBody, /Site Name/);

    const installResponse = await fetch(`http://127.0.0.1:${listening.port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        adminEmail: 'admin@example.com',
        adminPassword: 'super-secret-password',
        siteName: 'Phase 124 Site'
      }),
      redirect: 'manual'
    });

    assert.equal(installResponse.status, 302);
    assert.equal(installResponse.headers.get('location'), '/admin');

    assert.equal(fs.existsSync(path.join(cwd, 'data', 'install.lock')), true);
    assert.equal(fs.existsSync(path.join(cwd, 'data', 'users.json')), true);

    const installRouteAfter = await fetch(`http://127.0.0.1:${listening.port}/install`, { redirect: 'manual' });
    assert.equal(installRouteAfter.status, 404);

    const loginResponse = await fetch(`http://127.0.0.1:${listening.port}/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: 'admin@example.com',
        password: 'super-secret-password'
      }),
      redirect: 'manual'
    });

    assert.equal(loginResponse.status, 302);
    assert.equal(loginResponse.headers.get('location'), '/admin');
    assert.match(loginResponse.headers.get('set-cookie') ?? '', /nimb_admin_session=/);
  } finally {
    await started.server.stop();
  }
});
