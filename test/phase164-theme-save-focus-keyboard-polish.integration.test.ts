import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase164-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}
`);
};

test('phase 164: admin settings theme save flow has keyboard/focus management polish markers', async () => {
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

    assert.equal(html.includes('const focusElement = (element) => {'), true);
    assert.equal(html.includes("element.focus({ preventScroll: true });"), true);
    assert.equal(html.includes('const updateSaveThemeButtonState = () => {'), true);
    assert.equal(html.includes("const themeLoading = publicThemeSection?.getAttribute('aria-busy') === 'true';"), true);
    assert.equal(html.includes('saveThemeButton.disabled = disabled;'), true);
    assert.equal(html.includes("themeSelect?.addEventListener('keydown', (event) => {"), true);
    assert.equal(html.includes("if (event.key === 'Enter' && !saveThemeButton?.disabled) {"), true);
    assert.equal(html.includes('saveThemeButton?.click();'), true);
    assert.equal(html.includes('focusElement(themeSelect);'), true);
    assert.equal(html.includes('focusElement(saveThemeButton);'), true);
    assert.equal(html.includes('saveThemeButton.disabled = true;'), true);

    const buttonStateUpdateIndex = html.indexOf('const updateSaveThemeButtonState = () => {');
    const themeSelectChangeIndex = html.indexOf("themeSelect?.addEventListener('change', () => {");
    const themeSelectKeydownIndex = html.indexOf("themeSelect?.addEventListener('keydown', (event) => {");
    const saveThemeClickIndex = html.indexOf("saveThemeButton?.addEventListener('click', () => {");

    assert.equal(buttonStateUpdateIndex > -1, true);
    assert.equal(themeSelectChangeIndex > buttonStateUpdateIndex, true);
    assert.equal(themeSelectKeydownIndex > themeSelectChangeIndex, true);
    assert.equal(saveThemeClickIndex > themeSelectKeydownIndex, true);
  } finally {
    await server.stop();
  }
});
