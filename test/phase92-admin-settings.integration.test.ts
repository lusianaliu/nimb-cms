import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase92-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '92.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const withInstallState = async (run: () => Promise<void> | void) => {
  const previousContent = fs.existsSync(INSTALL_STATE_PATH)
    ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8')
    : null;

  try {
    await run();
  } finally {
    if (previousContent === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousContent, 'utf8');
    }
  }
};

test('phase 92: structured settings module resolves admin branding and theme through runtime settings', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '92.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const bootstrap = await createBootstrap({ cwd });

    assert.equal(typeof bootstrap.runtime.settings?.get, 'function');
    assert.equal(typeof bootstrap.runtime.settings?.set, 'function');

    const initialSiteName = bootstrap.runtime.settings.get('site.name');
    assert.equal(initialSiteName, 'My Nimb Site');

    await bootstrap.runtime.settings.set('site.name', 'Phase 92 Site');
    await bootstrap.runtime.settings.set('admin.branding.title', 'Phase 92 Admin');
    await bootstrap.runtime.settings.set('admin.branding.logoText', 'Phase92');
    await bootstrap.runtime.settings.set('admin.theme', 'plain');

    assert.equal(bootstrap.runtime.settings.get('site.name'), 'Phase 92 Site');
    assert.equal(bootstrap.runtime.settings.get('admin.branding.title'), 'Phase 92 Admin');

    await assert.rejects(
      () => bootstrap.runtime.settings.set('admin.unknown', 'x'),
      /Unknown reserved setting key/
    );

    const server = createHttpServer({
      runtime: bootstrap.runtime,
      config: bootstrap.config,
      startupTimestamp: '2026-01-01T00:00:00.000Z',
      port: 0,
      rootDirectory: cwd
    });

    const { port } = await server.start();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/admin-api/system`);
      assert.equal(response.status, 200);

      const payload = await response.json();
      assert.equal(payload.adminTheme, 'plain');
      assert.equal(payload.adminBranding.adminTitle, 'Phase 92 Admin');
      assert.equal(payload.adminBranding.logoText, 'Phase92');
    } finally {
      await server.stop();
    }
  });
});
