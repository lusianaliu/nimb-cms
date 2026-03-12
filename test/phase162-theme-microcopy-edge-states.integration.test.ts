import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase162-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 162: admin settings theme copy uses calmer non-technical edge-state language', async () => {
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

    assert.equal(html.includes('Coverage details unavailable'), true);
    assert.equal(html.includes('Coverage hint: Coverage details are not available right now.'), true);
    assert.equal(html.includes('No changes were made. This theme is already active.'), true);
    assert.equal(html.includes('Theme diagnostics: temporarily unavailable'), true);
    assert.equal(html.includes('Theme diagnostics are not available right now.'), true);
    assert.equal(html.includes('Nimb will use default theme templates for those pages.'), true);
    assert.equal(html.includes('Ready to save. This theme covers all core pages.'), true);
    assert.equal(html.includes('This is the default theme. It is complete and safe for all pages.'), true);
  } finally {
    await server.stop();
  }
});
