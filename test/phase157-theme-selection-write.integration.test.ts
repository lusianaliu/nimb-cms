import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase157-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

const writeSystemConfig = (cwd: string) => {
  const systemDir = path.join(cwd, 'data', 'system');
  fs.mkdirSync(systemDir, { recursive: true });
  fs.writeFileSync(path.join(systemDir, 'config.json'), `${JSON.stringify({
    installed: true,
    version: '157.0.0',
    installedAt: '2026-01-01T00:00:00.000Z'
  }, null, 2)}\n`);
};

const writeSettings = (cwd: string, theme: string) => {
  const dataDir = path.join(cwd, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'settings.json'), `${JSON.stringify({ theme }, null, 2)}\n`);
};

test('phase 157: admin theme write API validates and persists canonical theme selection', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeSystemConfig(cwd);
  writeSettings(cwd, 'default');

  const bootstrap = await createBootstrap({ cwd });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0,
    rootDirectory: cwd
  });

  const { port } = await server.start();

  try {
    const updateResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 'sunrise' })
    });

    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.configuredThemeId, 'sunrise');
    assert.equal(updated.resolvedThemeId, 'sunrise');
    assert.equal(updated.fallbackApplied, false);

    const reloadedStatus = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`);
    assert.equal(reloadedStatus.status, 200);
    const statusPayload = await reloadedStatus.json();
    assert.equal(statusPayload.configuredThemeId, 'sunrise');
    assert.equal(statusPayload.resolvedThemeId, 'sunrise');

    const persistedSettings = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'settings.json'), 'utf8'));
    assert.equal(persistedSettings.theme, 'sunrise');

    assert.equal(bootstrap.runtime.themes.getConfiguredThemeId(), 'sunrise');
    assert.equal(bootstrap.runtime.themes.getResolvedThemeId(), 'sunrise');

    const unknownThemeResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 'missing-theme' })
    });

    assert.equal(unknownThemeResponse.status, 400);
    const unknownPayload = await unknownThemeResponse.json();
    assert.equal(unknownPayload.error.code, 'UNKNOWN_THEME_ID');

    const blankThemeResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: '   ' })
    });

    assert.equal(blankThemeResponse.status, 400);
    const blankPayload = await blankThemeResponse.json();
    assert.equal(blankPayload.error.code, 'THEME_ID_REQUIRED');

    const malformedThemeResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 123 })
    });

    assert.equal(malformedThemeResponse.status, 400);
    const malformedPayload = await malformedThemeResponse.json();
    assert.equal(malformedPayload.error.code, 'INVALID_THEME_ID');

    const unchangedResponse = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 'sunrise' })
    });

    assert.equal(unchangedResponse.status, 200);
    const unchangedPayload = await unchangedResponse.json();
    assert.equal(unchangedPayload.configuredThemeId, 'sunrise');
    assert.equal(unchangedPayload.resolvedThemeId, 'sunrise');
  } finally {
    await server.stop();
  }
});
