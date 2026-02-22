import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PluginRuntime } from '../core/runtime/plugin-runtime/lifecycle-runner.ts';
import { RuntimeContracts } from '../src/core/plugins/runtime-contracts.js';

class TestLogger {
  info() {}
  warn() {}
  error() {}
}

const writePlugin = async (root, name, manifestBody, registerBody = 'export default () => () => {};') => {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'manifest.ts'), manifestBody);
  await fs.writeFile(path.join(dir, 'register.ts'), registerBody);
};

const createRuntime = (pluginsDirectory) => {
  const logger = new TestLogger();
  const runtimeContracts = new RuntimeContracts({ logger });
  return new PluginRuntime({
    pluginsDirectory,
    contracts: runtimeContracts.createContractSurface(),
    logger
  });
};

test('versioning resolves compatible provider versions', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-versioning-compatible-'));

  await writePlugin(tempRoot, 'provider', `
export const pluginManifest = {
  id: 'provider',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: {
    content: () => ({ get: () => 'ok' })
  },
  providedCapabilities: {
    content: { version: '1.2.0' }
  },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'consumer', `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  consumedCapabilities: {
    content: { range: '^1.0.0' }
  },
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`);

  const runtime = createRuntime(tempRoot);
  await runtime.start();

  const versions = runtime.getInspector().versions();
  assert.equal(versions.resolvedVersions.length, 1);
  assert.deepEqual(versions.rejectedPlugins, []);
  assert.equal(versions.resolvedVersions[0].providerId, 'provider');
});

test('versioning rejects mismatch ranges', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-versioning-mismatch-'));

  await writePlugin(tempRoot, 'provider', `
export const pluginManifest = {
  id: 'provider',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: {
    content: () => ({ get: () => 'ok' })
  },
  providedCapabilities: {
    content: { version: '2.0.0' }
  },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'consumer', `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  consumedCapabilities: {
    content: { range: '^1.0.0' }
  },
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`);

  const runtime = createRuntime(tempRoot);
  const records = await runtime.start();

  assert.equal(records.find((item) => item.id === 'consumer').state, 'failed');
  assert.deepEqual(runtime.getInspector().versions().rejectedPlugins, ['consumer']);
});

test('versioning rejects ambiguous equal-version providers', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-versioning-ambiguous-'));

  for (const name of ['provider-a', 'provider-b']) {
    await writePlugin(tempRoot, name, `
export const pluginManifest = {
  id: '${name}',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: {
    content: () => ({ get: () => '${name}' })
  },
  providedCapabilities: {
    content: { version: '1.1.0' }
  },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);
  }

  await writePlugin(tempRoot, 'consumer', `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  consumedCapabilities: {
    content: { range: '^1.0.0' }
  },
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`);

  const runtime = createRuntime(tempRoot);
  await runtime.start();

  const versions = runtime.getInspector().versions();
  assert.deepEqual(versions.rejectedPlugins, ['consumer']);
  assert.equal(runtime.getInspector().snapshot().diagnostics.some((entry) => entry.type === 'version:conflict'), true);
});

test('versioning selection is deterministic by highest compatible version', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-versioning-deterministic-'));

  await writePlugin(tempRoot, 'provider-old', `
export const pluginManifest = {
  id: 'provider-old',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: {
    content: () => ({ get: () => 'old' })
  },
  providedCapabilities: {
    content: { version: '1.0.1' }
  },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'provider-new', `
export const pluginManifest = {
  id: 'provider-new',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: {
    content: () => ({ get: () => 'new' })
  },
  providedCapabilities: {
    content: { version: '1.5.0' }
  },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'consumer', `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  consumedCapabilities: {
    content: { range: '^1.0.0' }
  },
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`);

  const runtime = createRuntime(tempRoot);
  await runtime.start();

  const versions = runtime.getInspector().versions();
  assert.equal(versions.resolvedVersions[0].providerId, 'provider-new');
  assert.equal(versions.resolvedVersions[0].version, '1.5.0');
});
