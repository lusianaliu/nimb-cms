import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-bootstrap-mode-'));

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
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const bootstrap = await createBootstrap({ cwd });

  assert.equal((bootstrap.runtime as { mode?: string }).mode, 'runtime');
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
