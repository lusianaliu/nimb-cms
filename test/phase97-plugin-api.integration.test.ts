import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase97-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '97.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const writePlugin = (
  cwd: string,
  pluginId: string,
  source: string,
  manifest: Partial<Record<'apiVersion' | 'capabilities' | 'name' | 'version' | 'entry', unknown>> = {}
) => {
  const directory = path.join(cwd, 'plugins', pluginId);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'plugin.json'), `${JSON.stringify({
    id: pluginId,
    name: pluginId,
    version: '1.0.0',
    entry: 'index.ts',
    apiVersion: '^1.0.0',
    capabilities: [],
    ...manifest
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'index.ts'), source);
};

test('phase 97: compatible plugin api range loads successfully', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(cwd, 'compatible-plugin', `
    export default function register(api) {
      globalThis.phase97Compatible = {
        apiVersion: api?.apiVersion,
        hasRuntime: Boolean(api?.runtime)
      };
    }
  `, { apiVersion: '^1.0.0' });

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  assert.deepEqual((globalThis as { phase97Compatible?: unknown }).phase97Compatible, {
    apiVersion: '1.0.0',
    hasRuntime: true
  });
  assert.equal(bootstrap.runtime.plugins.list().length, 1);
});

test('phase 97: incompatible plugin api range is rejected', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(cwd, 'incompatible-plugin', `
    export default function register() {
      globalThis.phase97IncompatibleLoaded = true;
    }
  `, { apiVersion: '^2.0.0' });

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  assert.equal((globalThis as { phase97IncompatibleLoaded?: boolean }).phase97IncompatibleLoaded, undefined);
  assert.equal(bootstrap.runtime.plugins.list().length, 0);
});

test('phase 97: plugin manifest requires apiVersion', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(cwd, 'missing-api-version', `
    export default function register() {
      globalThis.phase97MissingApiLoaded = true;
    }
  `, { apiVersion: undefined });

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  assert.equal((globalThis as { phase97MissingApiLoaded?: boolean }).phase97MissingApiLoaded, undefined);
  assert.equal(bootstrap.runtime.plugins.list().length, 0);
});

test('phase 97: plugin runtime surface is restricted to public contract', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(cwd, 'runtime-surface', `
    export default function register(api) {
      globalThis.phase97RuntimeSurface = {
        keys: Object.keys(api?.runtime ?? {}).sort(),
        hasCreateScopedRuntime: Boolean(api?.runtime?.createScopedRuntime)
      };
    }
  `);

  await createBootstrap({ cwd, mode: 'runtime' });

  const result = (globalThis as {
    phase97RuntimeSurface?: { keys?: string[]; hasCreateScopedRuntime?: boolean };
  }).phase97RuntimeSurface;

  assert.deepEqual(result?.keys, ['admin', 'capabilities', 'contentTypes', 'db', 'events', 'fieldTypes', 'hooks', 'http', 'plugins', 'settings']);
  assert.equal(result?.hasCreateScopedRuntime, false);
});
