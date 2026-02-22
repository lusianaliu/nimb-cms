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

test('topology rejects plugins with missing consumed capability providers', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-topology-missing-'));

  await writePlugin(
    tempRoot,
    'consumer-only',
    `
export const pluginManifest = {
  id: 'consumer-only',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  consumedCapabilities: ['missing:capability'],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0'
  }
};
`
  );

  const runtime = createRuntime(tempRoot);
  const records = await runtime.start();

  assert.equal(records[0].state, 'failed');
  const topology = runtime.getInspector().topology();
  assert.deepEqual(topology.unresolvedDependencies, [{ pluginId: 'consumer-only', capability: 'missing:capability' }]);
});

test('topology rejects circular capability dependencies', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-topology-cycle-'));

  await writePlugin(
    tempRoot,
    'a-plugin',
    `
export const pluginManifest = {
  id: 'a-plugin',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['a:cap'],
  exportedCapabilities: {
    'a:cap': () => ({ ok: true })
  },
  consumedCapabilities: ['b:cap'],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0',
    'plugin.registerCapability': '^1.0.0'
  }
};
`
  );

  await writePlugin(
    tempRoot,
    'b-plugin',
    `
export const pluginManifest = {
  id: 'b-plugin',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['b:cap'],
  exportedCapabilities: {
    'b:cap': () => ({ ok: true })
  },
  consumedCapabilities: ['a:cap'],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0',
    'plugin.registerCapability': '^1.0.0'
  }
};
`
  );

  const runtime = createRuntime(tempRoot);
  const records = await runtime.start();

  assert.deepEqual(records.map((record) => record.state), ['failed', 'failed']);
  const cycleDiagnostics = runtime.getInspector().snapshot().diagnostics.filter((entry) => entry.type === 'plugin.runtime.diagnostics.topology:validated');
  assert.equal(cycleDiagnostics.at(-1).payload.cycles, 1);
});

test('topology activation planning is deterministic with load-order fallback', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-topology-order-'));

  await writePlugin(
    tempRoot,
    'provider-b',
    `
export const pluginManifest = {
  id: 'provider-b',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['cap:b'],
  exportedCapabilities: {
    'cap:b': () => ({ run: () => 'b' })
  },
  requiredPlatformContracts: {
    'plugin.registerCapability': '^1.0.0'
  }
};
`
  );

  await writePlugin(
    tempRoot,
    'provider-a',
    `
export const pluginManifest = {
  id: 'provider-a',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['cap:a'],
  exportedCapabilities: {
    'cap:a': () => ({ run: () => 'a' })
  },
  requiredPlatformContracts: {
    'plugin.registerCapability': '^1.0.0'
  }
};
`
  );

  await writePlugin(
    tempRoot,
    'consumer',
    `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  consumedCapabilities: ['cap:a', 'cap:b'],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0'
  }
};
`
  );

  const runtime = createRuntime(tempRoot);
  await runtime.start();

  const topology = runtime.getInspector().topology();
  assert.deepEqual(topology.activationOrder, ['provider-a', 'provider-b', 'consumer']);
});

test('topology snapshot removes unloaded plugin nodes and edges', async () => {
  const logger = new TestLogger();
  const runtimeContracts = new RuntimeContracts({ logger });
  const runtime = new PluginRuntime({
    pluginsDirectory: path.resolve(process.cwd(), 'plugins'),
    contracts: runtimeContracts.createContractSurface(),
    logger
  });

  await runtime.start();
  const unloaded = await runtime.unload('content-basic');

  assert.equal(unloaded, true);
  const topology = runtime.getInspector().topology();
  assert.equal(topology.nodes.some((node) => node.pluginId === 'content-basic'), false);
  assert.equal(topology.edges.some((edge) => edge.from === 'content-basic' || edge.to === 'content-basic'), false);
});
