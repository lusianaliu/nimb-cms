import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase94-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '94.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const writePlugin = (cwd: string, pluginId: string, manifest: Record<string, unknown>, source: string) => {
  const directory = path.join(cwd, 'plugins', pluginId);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'index.ts'), source);
};

test('phase 94: plugin manifest loader validates manifests, scopes runtime and populates plugin registry', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(
    cwd,
    'valid-plugin',
    {
      id: 'valid-plugin',
      name: 'Valid Plugin',
      version: '1.0.0',
      entry: 'index.ts',
      apiVersion: '^1.0.0',
      capabilities: ['settings.read']
    },
    `
      export default function register(api) {
        globalThis.phase94 = globalThis.phase94 ?? { executions: 0 };
        globalThis.phase94.executions += 1;
        globalThis.phase94.hasSettings = Boolean(api?.runtime?.settings);
        globalThis.phase94.hasHooks = Boolean(api?.runtime?.hooks);
        globalThis.phase94.capabilities = api?.runtime?.capabilities ?? [];
      }
    `
  );

  writePlugin(
    cwd,
    'invalid-manifest',
    {
      id: 'invalid-manifest',
      name: 'Invalid Manifest',
      version: '1.0.0',
      entry: 'index.ts',
      unknownRootField: true
    },
    `
      export default function register() {
        globalThis.phase94InvalidWasLoaded = true;
      }
    `
  );

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const phase94 = (globalThis as {
    phase94?: { executions?: number; hasSettings?: boolean; hasHooks?: boolean; capabilities?: string[] };
    phase94InvalidWasLoaded?: boolean;
  }).phase94;

  assert.equal(phase94?.executions, 1);
  assert.equal(phase94?.hasSettings, true);
  assert.equal(phase94?.hasHooks, true);
  assert.deepEqual(phase94?.capabilities, ['settings.read']);
  assert.equal((globalThis as { phase94InvalidWasLoaded?: boolean }).phase94InvalidWasLoaded, undefined);

  const plugins = bootstrap.runtime.plugins.list();
  assert.equal(plugins.length, 1);
  assert.deepEqual(plugins[0], {
    id: 'valid-plugin',
    name: 'Valid Plugin',
    version: '1.0.0',
    apiVersion: '^1.0.0',
    capabilities: ['settings.read'],
    entry: path.join(cwd, 'plugins', 'valid-plugin', 'index.ts'),
    main: 'index.ts'
  });
  assert.deepEqual(bootstrap.runtime.plugins.get('valid-plugin'), plugins[0]);
});
