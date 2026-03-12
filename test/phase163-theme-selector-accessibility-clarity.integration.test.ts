import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase163-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}
`);
};

test('phase 163: admin settings theme selector flow has clearer accessibility semantics and status channels', async () => {
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

    assert.equal(html.includes('id="public-theme-section" aria-labelledby="public-theme-heading" aria-busy="true"'), true);
    assert.equal(html.includes('<h2 id="public-theme-heading">Public theme</h2>'), true);
    assert.equal(html.includes('id="activeThemeId" name="activeThemeId" aria-describedby="theme-selection-help theme-coverage-hint theme-state theme-selection-warning"'), true);
    assert.equal(html.includes('id="theme-status" role="status" aria-live="polite" aria-atomic="true"'), true);
    assert.equal(html.includes('id="theme-alert" role="alert" aria-live="assertive" aria-atomic="true"'), true);
    assert.equal(html.includes("const setThemeStatus = (text, tone = 'polite') =>"), true);
    assert.equal(html.includes("themeStatus.textContent = tone === 'polite' ? text : '';"), true);
    assert.equal(html.includes("themeAlert.textContent = tone === 'assertive' ? text : '';"), true);
    assert.equal(html.includes("publicThemeSection.setAttribute('aria-busy', 'false');"), true);
    assert.equal(html.includes("setThemeStatus('Theme details are temporarily unavailable. Refresh and try again.', 'assertive');"), true);
    assert.equal(html.includes("setThemeStatus('Choose a theme before saving.', 'assertive');"), true);

    const selectionHelpIndex = html.indexOf('id="theme-selection-help"');
    const coverageHintIndex = html.indexOf('id="theme-coverage-hint"');
    const themeStateIndex = html.indexOf('id="theme-state"');
    const diagnosticsIndex = html.indexOf('id="theme-diagnostics"');
    const saveThemeButtonIndex = html.indexOf('id="save-theme-button"');
    const themeStatusIndex = html.indexOf('id="theme-status"');

    assert.equal(selectionHelpIndex > -1, true);
    assert.equal(coverageHintIndex > selectionHelpIndex, true);
    assert.equal(themeStateIndex > coverageHintIndex, true);
    assert.equal(diagnosticsIndex > themeStateIndex, true);
    assert.equal(saveThemeButtonIndex > diagnosticsIndex, true);
    assert.equal(themeStatusIndex > saveThemeButtonIndex, true);
  } finally {
    await server.stop();
  }
});
