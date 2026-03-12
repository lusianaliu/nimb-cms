import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase156-'));

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
    version: '156.0.0',
    installedAt: '2026-01-01T00:00:00.000Z'
  }, null, 2)}\n`);
};

const writeSettings = (cwd: string, theme: string) => {
  const dataDir = path.join(cwd, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'settings.json'), `${JSON.stringify({ theme }, null, 2)}\n`);
};

test('phase 156: admin read API exposes theme status with configured/resolved visibility', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeSystemConfig(cwd);
  writeSettings(cwd, 'missing-theme');

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
    const response = await fetch(`http://127.0.0.1:${port}/admin-api/system/themes`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');

    const payload = await response.json();
    assert.equal(payload.configuredThemeId, 'missing-theme');
    assert.equal(payload.resolvedThemeId, 'default');
    assert.equal(payload.defaultThemeId, 'default');
    assert.equal(payload.fallbackApplied, true);
    assert.deepEqual(payload.themes.map((theme) => theme.id), ['default', 'sunrise']);
    assert.deepEqual(payload.themes[0].templates, ['homepage', 'page', 'post-list', 'post-page', 'not-found']);
    assert.deepEqual(payload.themes[0].missingTemplates, []);
    assert.equal(payload.themes[0].supportsAllCanonicalTemplates, true);
  } finally {
    await server.stop();
  }
});
