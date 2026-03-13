import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase165-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}
`);
};

test('phase 165: admin settings theme flow keeps canonical runtime paths and interaction outcomes wired', async () => {
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

    const settingsResponse = await fetch(`http://127.0.0.1:${port}/admin/settings`, {
      headers: { cookie: authCookie }
    });

    assert.equal(settingsResponse.status, 200);
    const html = await settingsResponse.text();

    assert.equal(html.includes("fetch('/admin-api/system/themes')"), true);
    assert.equal(html.includes("fetch('/admin-api/system/themes', {"), true);
    assert.equal(html.includes("themeSelect?.addEventListener('keydown', (event) => {"), true);
    assert.equal(html.includes("if (event.key === 'Enter' && !saveThemeButton?.disabled) {"), true);
    assert.equal(html.includes("setThemeStatus('No changes were made. This theme is already active.');"), true);
    assert.equal(html.includes("setThemeStatus('Choose a theme before saving.', 'assertive');"), true);
    assert.equal(html.includes("setThemeStatus('Could not save theme: ' + message, 'assertive');"), true);
    assert.equal(html.includes('focusElement(saveThemeButton);'), true);
    assert.equal(html.includes('focusElement(themeSelect);'), true);
    assert.equal(html.includes("saveThemeButton.disabled = true;"), true);

    const getResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      headers: { cookie: authCookie }
    });
    assert.equal(getResponse.status, 200);
    const initial = await getResponse.json();
    assert.equal(typeof initial.configuredThemeId, 'string');
    assert.equal(Array.isArray(initial.themes), true);
    assert.equal(initial.themes.length >= 2, true);

    const targetThemeId = initial.configuredThemeId === 'default' ? 'sunrise' : 'default';
    const updateResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ themeId: targetThemeId })
    });

    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.configuredThemeId, targetThemeId);
    assert.equal(updated.resolvedThemeId, targetThemeId);

    const noOpResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ themeId: targetThemeId })
    });
    assert.equal(noOpResponse.status, 200);
    const noOpPayload = await noOpResponse.json();
    assert.equal(noOpPayload.configuredThemeId, targetThemeId);

    const invalidResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: {
        cookie: authCookie,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ themeId: 'does-not-exist' })
    });

    assert.equal(invalidResponse.status, 400);
    const invalidPayload = await invalidResponse.json();
    assert.equal(invalidPayload?.error?.code, 'UNKNOWN_THEME_ID');
  } finally {
    await server.stop();
  }
});
