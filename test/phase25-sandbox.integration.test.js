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

test('phase 25: sandbox crash is isolated and does not stop other plugins', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-sandbox-crash-'));

  await writePlugin(
    root,
    'crashy',
    `
export const pluginManifest = {
  id: 'crashy',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.runtime': '^1.0.0' }
};
`,
    `
export default () => {
  throw new Error('sandbox crash');
};
`
  );

  await writePlugin(
    root,
    'stable',
    `
export const pluginManifest = {
  id: 'stable',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.runtime': '^1.0.0' }
};
`
  );

  const runtime = createRuntime(root);
  const records = await runtime.start();

  assert.equal(records.find((entry) => entry.id === 'crashy')?.state, 'failed');
  assert.equal(records.find((entry) => entry.id === 'stable')?.state, 'active');

  const sandbox = runtime.getInspector().sandbox();
  assert.equal(sandbox.executions.some((entry) => entry.pluginId === 'crashy' && entry.status === 'failure'), true);

  const diagnostics = runtime.getInspector().snapshot().diagnostics;
  assert.equal(diagnostics.some((entry) => entry.type === 'sandbox:error' && entry.payload.pluginId === 'crashy'), true);

  const health = runtime.getInspector().health();
  assert.equal(health.failures.some((entry) => entry.pluginId === 'crashy' && entry.source === 'lifecycle'), true);
});

test('phase 25: sandbox preserves deterministic execution order', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-sandbox-order-'));

  await writePlugin(
    root,
    'alpha',
    `
export const pluginManifest = {
  id: 'alpha',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['alpha:cap'],
  exportedCapabilities: { 'alpha:cap': () => ({ ok: true }) },
  consumedCapabilities: [],
  requiredPlatformContracts: {
    'plugin.runtime': '^1.0.0',
    'plugin.registerCapability': '^1.0.0'
  }
};
`
  );

  await writePlugin(
    root,
    'beta',
    `
export const pluginManifest = {
  id: 'beta',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  consumedCapabilities: ['alpha:cap'],
  declaredCapabilities: [],
  requiredPlatformContracts: {
    'plugin.runtime': '^1.0.0',
    'plugin.useCapability': '^1.0.0'
  }
};
`
  );

  const runtime = createRuntime(root);
  await runtime.start();

  const activationOrder = runtime.getInspector().topology().activationOrder;
  const sandboxOrder = runtime.getInspector().sandbox().executions.map((entry) => entry.pluginId);

  assert.deepEqual(sandboxOrder, activationOrder);

  const diagnostics = runtime.getInspector().snapshot().diagnostics.filter((entry) => entry.type === 'sandbox:start');
  assert.deepEqual(
    diagnostics.map((entry) => entry.payload.pluginId),
    activationOrder
  );
});

test('phase 25: sandbox denies contract mutation and triggers recovery interaction', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-sandbox-mutation-'));

  await writePlugin(
    root,
    'mutator',
    `
export const pluginManifest = {
  id: 'mutator',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.runtime': '^1.0.0' }
};
`,
    `
export default (runtime) => {
  runtime.state = {};
  return () => {};
};
`
  );

  const runtime = createRuntime(root);
  await runtime.start();

  const diagnostics = runtime.getInspector().snapshot().diagnostics;
  assert.equal(diagnostics.some((entry) => entry.type === 'sandbox:error' && entry.payload.pluginId === 'mutator'), true);
  assert.equal(diagnostics.some((entry) => entry.type === 'sandbox:terminated' && entry.payload.result === 'failure'), true);

  const health = runtime.getInspector().health();
  assert.equal(health.recoveryActions.some((entry) => entry.pluginId === 'mutator'), true);
});
