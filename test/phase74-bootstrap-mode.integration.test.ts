import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-bootstrap-mode-'));

const INSTALL_STATE_PATH = '/data/system/install.json';

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

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

test('bootstrap defaults to runtime mode', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '74.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const bootstrap = await createBootstrap({ cwd });

    assert.equal((bootstrap.runtime as { mode?: string }).mode, 'runtime');
  });
});

test('bootstrap install mode skips plugin loading', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  (globalThis as { phase74PluginLoaded?: number }).phase74PluginLoaded = 0;

  const pluginsDirectory = path.join(cwd, 'plugins', 'sample');
  fs.mkdirSync(pluginsDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginsDirectory, 'index.ts'), `
    export default {
      name: 'sample',
      setup() {
        globalThis.phase74PluginLoaded = (globalThis.phase74PluginLoaded ?? 0) + 1;
      }
    };
  `);

  await createBootstrap({ cwd, mode: 'install' });

  assert.equal((globalThis as { phase74PluginLoaded?: number }).phase74PluginLoaded, 0);
});

test('bootstrap exposes selected mode on runtime', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'cli' });

  assert.equal((bootstrap.runtime as { mode?: string }).mode, 'cli');
});
