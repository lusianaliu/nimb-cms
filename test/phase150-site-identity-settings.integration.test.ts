import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase150-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 150: admin settings page explains site identity fields for non-technical users', async () => {
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
    const authCookie = (loginResponse.headers.get('set-cookie') ?? '').split(';')[0];

    const response = await fetch(`http://127.0.0.1:${port}/admin/settings`, {
      headers: { cookie: authCookie }
    });

    assert.equal(response.status, 200);
    const html = await response.text();

    assert.equal(html.includes('Site Settings'), true);
    assert.equal(html.includes('Website name'), true);
    assert.equal(html.includes('Homepage introduction'), true);
    assert.equal(html.includes('Footer text'), true);
    assert.equal(html.includes('Save site settings'), true);
    assert.equal(html.includes('Settings saved. View your website to confirm the update.'), true);
  } finally {
    await server.stop();
  }
});
