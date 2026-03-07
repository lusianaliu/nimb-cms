import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase127-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '127.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

test('phase 127: loader scans plugins directory, loads plugin and executes activate lifecycle', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const pluginDirectory = path.join(cwd, 'plugins', 'example-plugin');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'plugin.json'), `${JSON.stringify({
    name: 'example-plugin',
    version: '1.0.0',
    main: 'index.ts'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(pluginDirectory, 'index.ts'), `
    export function activate(runtime) {
      globalThis.phase127 = {
        hasRuntime: Boolean(runtime),
        pluginActivated: true
      };
    }
  `);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  const phase127 = (globalThis as {
    phase127?: { hasRuntime?: boolean; pluginActivated?: boolean }
  }).phase127;

  assert.deepEqual(phase127, {
    hasRuntime: true,
    pluginActivated: true
  });

  assert.equal(bootstrap.runtime.plugins.list().length, 1);
  assert.deepEqual(bootstrap.runtime.plugins.get('example-plugin'), {
    id: 'example-plugin',
    name: 'example-plugin',
    version: '1.0.0',
    path: pluginDirectory,
    entry: path.join(pluginDirectory, 'index.ts'),
    apiVersion: undefined,
    capabilities: []
  });
});
