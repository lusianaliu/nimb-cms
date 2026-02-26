import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { isInstalled, markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase75-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
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

test('phase 75: missing install marker selects install mode by default', async () => {
  await withInstallState(async () => {
    fs.rmSync(INSTALL_STATE_PATH, { force: true });

    const cwd = mkdtemp();
    writeConfig(cwd);

    const bootstrap = await createBootstrap({ cwd });

    assert.equal((bootstrap.runtime as { mode?: string }).mode, 'install');
  });
});

test('phase 75: existing install marker selects runtime mode by default', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '75.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);

    const bootstrap = await createBootstrap({ cwd });

    assert.equal((bootstrap.runtime as { mode?: string }).mode, 'runtime');
  });
});

test('phase 75: markInstalled creates valid install state file', async () => {
  await withInstallState(async () => {
    fs.rmSync(INSTALL_STATE_PATH, { force: true });

    const installState = markInstalled({ version: '75.1.0' });
    const persisted = JSON.parse(fs.readFileSync(INSTALL_STATE_PATH, 'utf8'));

    assert.equal(isInstalled(), true);
    assert.equal(typeof persisted.installedAt, 'string');
    assert.equal(Number.isNaN(Date.parse(persisted.installedAt)), false);
    assert.equal(persisted.version, '75.1.0');
    assert.deepEqual(persisted, installState);
  });
});
