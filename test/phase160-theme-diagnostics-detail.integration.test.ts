import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase160-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 160: admin settings includes lightweight read-only theme diagnostics details', async () => {
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

    assert.equal(html.includes('id="theme-diagnostics"'), true);
    assert.equal(html.includes('id="theme-diagnostics-summary"'), true);
    assert.equal(html.includes('id="theme-diagnostics-list"'), true);
    assert.equal(html.includes('Theme diagnostics: selected theme is partial (default theme may be used per page)'), true);
    assert.equal(html.includes('Coverage for selected theme: missing core templates — '), true);
    assert.equal(html.includes('Nimb will use default theme templates for those pages.'), true);
    assert.equal(html.includes('The saved theme could not be used fully right now, so Nimb is using the default theme.'), true);
  } finally {
    await server.stop();
  }
});

test('phase 160: canonical theme status API still exposes metadata used by diagnostics details', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const readResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`);
    assert.equal(readResponse.status, 200);
    const payload = await readResponse.json();

    assert.equal(typeof payload.configuredThemeId, 'string');
    assert.equal(typeof payload.resolvedThemeId, 'string');
    assert.equal(typeof payload.defaultThemeId, 'string');
    assert.equal(typeof payload.fallbackApplied, 'boolean');

    assert.equal(Array.isArray(payload.themes), true);
    assert.equal(payload.themes.length > 0, true);

    const firstTheme = payload.themes[0];
    assert.equal(typeof firstTheme.id, 'string');
    assert.equal(Array.isArray(firstTheme.missingTemplates), true);
    assert.equal(typeof firstTheme.supportsAllCanonicalTemplates, 'boolean');
  } finally {
    await server.stop();
  }
});
