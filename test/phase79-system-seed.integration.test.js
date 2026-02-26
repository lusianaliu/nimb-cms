import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase79-'));

const writeConfig = (cwd) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

const withInstallState = async (run) => {
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

test('phase 79: install lifecycle seeds system types and metadata for runtime', async () => {
  await withInstallState(async () => {
    fs.rmSync(INSTALL_STATE_PATH, { force: true });

    const cwd = mkdtemp();
    writeConfig(cwd);

    const installBootstrap = await createBootstrap({ cwd, mode: 'install' });
    installBootstrap.runtime.events.emit('system.installed', { version: '0.1.0' });

    assert.ok(installBootstrap.runtime.contentTypes.get('page'));
    assert.ok(installBootstrap.runtime.contentTypes.get('post'));
    assert.ok(installBootstrap.runtime.contentTypes.get('settings'));

    const installMetadataEntries = installBootstrap.runtime.contentStore.list('settings');
    assert.equal(installMetadataEntries.length, 1);

    fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
    fs.writeFileSync(INSTALL_STATE_PATH, `${JSON.stringify({
      installedAt: new Date().toISOString(),
      version: '0.1.0'
    }, null, 2)}\n`, 'utf8');

    const runtimeBootstrap = await createBootstrap({ cwd, mode: 'runtime' });

    assert.ok(runtimeBootstrap.runtime.contentTypes.get('page'));
    assert.ok(runtimeBootstrap.runtime.contentTypes.get('post'));
    assert.ok(runtimeBootstrap.runtime.contentTypes.get('settings'));

    const metadataEntries = runtimeBootstrap.runtime.contentStore.list('settings');
    assert.equal(metadataEntries.length, 1);

    const metadata = metadataEntries[0].data;
    assert.equal(metadata.siteName, 'My Nimb Site');
    assert.equal(metadata.version, '0.1.0');
    assert.equal(Number.isNaN(Date.parse(String(metadata.installedAt))), false);
  });
});
