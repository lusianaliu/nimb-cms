import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase158-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 158: admin settings page exposes minimal theme selection UX bound to canonical theme APIs', async () => {
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

    assert.equal(html.includes('Public theme'), true);
    assert.equal(html.includes('id="activeThemeId"'), true);
    assert.equal(html.includes('id="save-theme-button"'), true);
    assert.equal(html.includes('id="theme-state"'), true);
    assert.equal(html.includes('id="theme-selection-warning"'), true);
    assert.equal(html.includes('/admin-api/system/themes'), true);
    assert.equal(html.includes('Default fallback is active.'), true);
    assert.equal(html.includes('This theme is already active. No save was needed.'), true);
    assert.equal(html.includes('Theme saved and active. Your public website now uses the selected theme.'), true);
    assert.equal(html.includes('supports all canonical templates'), true);
  } finally {
    await server.stop();
  }
});

test('phase 158: canonical theme read/write API remains coherent after admin UX additions', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const readResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`);
    assert.equal(readResponse.status, 200);
    const initialPayload = await readResponse.json();
    assert.equal(Array.isArray(initialPayload.themes), true);
    assert.equal(typeof initialPayload.configuredThemeId, 'string');
    assert.equal(typeof initialPayload.resolvedThemeId, 'string');

    const updateResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 'sunrise' })
    });

    assert.equal(updateResponse.status, 200);
    const updatedPayload = await updateResponse.json();
    assert.equal(updatedPayload.configuredThemeId, 'sunrise');
    assert.equal(updatedPayload.resolvedThemeId, 'sunrise');
    assert.equal(updatedPayload.fallbackApplied, false);
    assert.equal(updatedPayload.themes[0].supportsAllCanonicalTemplates, true);

    const invalidResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 'not-a-theme' })
    });

    assert.equal(invalidResponse.status, 400);
    const invalidPayload = await invalidResponse.json();
    assert.equal(invalidPayload?.error?.code, 'UNKNOWN_THEME_ID');

    const reloadedResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`);
    assert.equal(reloadedResponse.status, 200);
    const reloadedPayload = await reloadedResponse.json();
    assert.equal(reloadedPayload.configuredThemeId, 'sunrise');
    assert.equal(reloadedPayload.resolvedThemeId, 'sunrise');
  } finally {
    await server.stop();
  }
});
