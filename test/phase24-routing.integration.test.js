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

const createRuntime = (pluginsDirectory, routingPolicies = {}) => {
  const logger = new TestLogger();
  const runtimeContracts = new RuntimeContracts({ logger });
  return new PluginRuntime({
    pluginsDirectory,
    contracts: runtimeContracts.createContractSurface(),
    routingPolicies,
    logger
  });
};

test('routing is deterministic for weighted multi-provider capability selection', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-routing-weighted-'));

  await writePlugin(tempRoot, 'provider-a', `
export const pluginManifest = {
  id: 'provider-a',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: { content: () => ({ value: async () => 'a' }) },
  providedCapabilities: { content: { version: '1.0.0' } },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'provider-b', `
export const pluginManifest = {
  id: 'provider-b',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: { content: () => ({ value: async () => 'b' }) },
  providedCapabilities: { content: { version: '1.0.0' } },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'consumer', `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`);

  const runtime = createRuntime(tempRoot, {
    content: {
      type: 'weighted',
      salt: 'phase24',
      weights: {
        'provider-a': 3,
        'provider-b': 1
      }
    }
  });

  await runtime.start();

  const capability = runtime.capabilityResolver.resolveForConsumer('consumer', 'content');
  const one = await capability.value();
  const two = await capability.value();

  assert.equal(one, two);
  const selected = runtime.getInspector().routing().decisions
    .filter((entry) => entry.capability === 'content' && entry.invocationKey === 'value')
    .map((entry) => entry.providerId);

  assert.ok(selected.length >= 2);
  assert.equal(selected[0], selected[1]);
});

test('routing fallback chain selects next active provider and emits diagnostics', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-routing-fallback-'));

  await writePlugin(tempRoot, 'provider-primary', `
export const pluginManifest = {
  id: 'provider-primary',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: { content: () => ({ value: async () => 'primary' }) },
  providedCapabilities: { content: { version: '1.0.0' } },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'provider-secondary', `
export const pluginManifest = {
  id: 'provider-secondary',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: { content: () => ({ value: async () => 'secondary' }) },
  providedCapabilities: { content: { version: '1.0.0' } },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'consumer', `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`);

  const runtime = createRuntime(tempRoot, {
    content: {
      type: 'fallback',
      chain: ['provider-primary', 'provider-secondary']
    }
  });

  await runtime.start();
  await runtime.unload('provider-primary');

  const capability = runtime.capabilityResolver.resolveForConsumer('consumer', 'content');
  const result = await capability.value();
  assert.equal(result, 'secondary');

  const diagnostics = runtime.getInspector().snapshot().diagnostics;
  assert.equal(diagnostics.some((event) => event.type === 'routing:fallback'), true);
});

test('routing rejects capability invocation when no version-compatible provider exists', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-routing-version-'));

  await writePlugin(tempRoot, 'provider-v2', `
export const pluginManifest = {
  id: 'provider-v2',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: { content: () => ({ value: async () => 'v2' }) },
  providedCapabilities: { content: { version: '2.0.0' } },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'consumer', `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  consumedCapabilities: { content: { range: '^1.0.0' } },
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`);

  const runtime = createRuntime(tempRoot, {
    content: { type: 'priority', order: ['provider-v2'] }
  });

  await runtime.start();

  assert.throws(() => runtime.capabilityResolver.resolveForConsumer('consumer', 'content'), /provider not found/);
  assert.equal(runtime.getInspector().snapshot().diagnostics.some((event) => event.type === 'routing:rejected'), true);
});

test('routing decisions include topology key updates', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-routing-topology-'));

  await writePlugin(tempRoot, 'provider-a', `
export const pluginManifest = {
  id: 'provider-a',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: { content: () => ({ value: async () => 'a' }) },
  providedCapabilities: { content: { version: '1.0.0' } },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'consumer', `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`);

  await writePlugin(tempRoot, 'provider-b', `
export const pluginManifest = {
  id: 'provider-b',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content'],
  exportedCapabilities: { content: () => ({ value: async () => 'b' }) },
  providedCapabilities: { content: { version: '1.0.0' } },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`);

  const runtime = createRuntime(tempRoot, {
    content: { type: 'priority', order: ['provider-a', 'provider-b'] }
  });

  await runtime.start();
  const capability = runtime.capabilityResolver.resolveForConsumer('consumer', 'content');
  await capability.value();

  const before = runtime.getInspector().routing().decisions.at(-1).topologyKey;
  await runtime.unload('provider-a');
  await capability.value();
  const after = runtime.getInspector().routing().decisions.at(-1).topologyKey;

  assert.notEqual(before, after);
});
