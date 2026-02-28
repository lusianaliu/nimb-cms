import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase93-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '93.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
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

test('phase 93: runtime capability guard layer scopes settings access without affecting core runtime', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '93.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const bootstrap = await createBootstrap({ cwd });

    assert.equal(typeof bootstrap.runtime.createScopedRuntime, 'function');

    const readWriteScope = bootstrap.runtime.createScopedRuntime(['settings.read', 'settings.write']);
    const readOnlyScope = bootstrap.runtime.createScopedRuntime(['settings.read']);

    await readWriteScope.settings.set('site.name', 'Scoped Site');
    assert.equal(readWriteScope.settings.get('site.name'), 'Scoped Site');

    assert.throws(
      () => readOnlyScope.settings.set('site.name', 'Blocked Write'),
      /Missing capability \"settings.write\" for runtime operation \"settings.set\"/
    );

    const writeOnlyScope = bootstrap.runtime.createScopedRuntime(['settings.write']);
    assert.throws(
      () => writeOnlyScope.settings.get('site.name'),
      /Missing capability "settings.read" for runtime operation "settings.get"/
    );

    await bootstrap.runtime.settings.set('site.name', 'Core Runtime Write');
    assert.equal(bootstrap.runtime.settings.get('site.name'), 'Core Runtime Write');

    assert.equal((readOnlyScope as { contentStore?: unknown }).contentStore, undefined);
    assert.notEqual(readWriteScope, readOnlyScope);
    assert.deepEqual(readOnlyScope.capabilities, ['settings.read']);
  });
});
