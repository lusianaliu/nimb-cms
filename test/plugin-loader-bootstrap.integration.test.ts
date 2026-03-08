import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-plugin-bootstrap-'));

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

test('bootstrap loads manifest-driven plugins and registers metadata', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const pluginsDirectory = path.join(cwd, 'plugins', 'sample');
  fs.mkdirSync(pluginsDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginsDirectory, 'plugin.json'), `${JSON.stringify({
    id: 'sample',
    name: 'Sample',
    version: '1.0.0',
    entry: 'index.ts',
    apiVersion: '^1.0.0',
    capabilities: ['settings.read']
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(pluginsDirectory, 'index.ts'), `
    export default function register(api) {
      globalThis.pluginLoaderBootstrap = {
        capabilities: api.runtime.capabilities,
        canReadSettings: Boolean(api.runtime.settings),
        hasHooks: Boolean(api.runtime.hooks)
      };
    }
  `);

  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z', mode: 'runtime' });

  assert.deepEqual((globalThis as { pluginLoaderBootstrap?: unknown }).pluginLoaderBootstrap, {
    capabilities: ['settings.read'],
    canReadSettings: true,
    hasHooks: true
  });

  assert.deepEqual(bootstrap.runtime.plugins.list(), [{
    id: 'sample',
    name: 'Sample',
    version: '1.0.0',
    apiVersion: '^1.0.0',
    capabilities: ['settings.read'],
    entry: path.join(cwd, 'plugins', 'sample', 'index.ts'),
    main: 'index.ts'
  }]);
});
