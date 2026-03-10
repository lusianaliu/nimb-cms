import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer } from './helpers/create-test-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase141-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

test('phase 141: installer serves page and writes system config/admin records', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const installPage = await fetch(`http://127.0.0.1:${listening.port}/install`, { redirect: 'manual' });
    assert.equal(installPage.status, 200);

    const body = await installPage.text();
    assert.match(body, /Set up your Nimb website/);
    assert.match(body, /Website name/);
    assert.match(body, /Admin username/);
    assert.match(body, /Confirm admin password/);

    const submit = await fetch(`http://127.0.0.1:${listening.port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        siteTitle: 'Phase 141 Site',
        adminUser: 'nimb-admin',
        adminPassword: 'super-secret-password1',
        adminPasswordConfirm: 'super-secret-password1'
      }),
      redirect: 'manual'
    });

    assert.equal(submit.status, 302);
    assert.equal(submit.headers.get('location'), '/admin/login?welcome=1');

    const systemConfigPath = path.join(cwd, 'data', 'system', 'config.json');
    const adminPath = path.join(cwd, 'data', 'system', 'admin.json');
    assert.equal(fs.existsSync(systemConfigPath), true);
    assert.equal(fs.existsSync(adminPath), true);

    const systemConfig = JSON.parse(fs.readFileSync(systemConfigPath, 'utf8'));
    assert.equal(systemConfig.siteTitle, 'Phase 141 Site');
    assert.equal(Number.isNaN(Date.parse(systemConfig.installedAt ?? '')), false);

    const admin = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
    assert.equal(admin.username, 'nimb-admin');
    assert.match(admin.passwordHash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);

    const afterInstall = await fetch(`http://127.0.0.1:${listening.port}/install`, { redirect: 'manual' });
    assert.equal(afterInstall.status, 302);
    assert.equal(afterInstall.headers.get('location'), '/admin/login?install=complete');
  } finally {
    await started.server.stop();
  }
});

test('phase 145: installer returns clear validation errors and keeps entered values', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const mismatch = await fetch(`http://127.0.0.1:${listening.port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        siteTitle: 'My Website',
        adminUser: 'owner_1',
        adminPassword: 'Password123',
        adminPasswordConfirm: 'Password999'
      }),
      redirect: 'manual'
    });

    assert.equal(mismatch.status, 400);
    const body = await mismatch.text();
    assert.match(body, /Admin password confirmation does not match/);
    assert.match(body, /value="My Website"/);
    assert.match(body, /value="owner_1"/);
  } finally {
    await started.server.stop();
  }
});
