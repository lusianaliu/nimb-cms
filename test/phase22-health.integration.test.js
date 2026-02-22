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

test('phase 22: event subscriber crash is isolated by health monitor', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-health-isolation-'));

  await writePlugin(
    root,
    'publisher',
    `
export const pluginManifest = {
  id: 'publisher',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  exportedEvents: ['demo:event'],
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.emit': '^1.0.0' }
};
`
  );

  await writePlugin(
    root,
    'subscriber',
    `
export const pluginManifest = {
  id: 'subscriber',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  consumedCapabilities: [],
  requiredPlatformContracts: { 'plugin.on': '^1.0.0' }
};
`,
    `
export default ({ on }) => {
  on('demo:event', async () => {
    throw new Error('subscriber crash');
  });
  return () => {};
};
`
  );

  const runtime = createRuntime(root);
  await runtime.start();
  await runtime.eventSystem.emit('publisher', 'demo:event', { ok: true });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const health = runtime.getInspector().health();
  assert.equal(health.plugins.find((entry) => entry.pluginId === 'subscriber')?.status, 'isolated');
  assert.equal(health.failures.some((entry) => entry.source === 'event'), true);
});

test('phase 22: transient lifecycle failures retry deterministically', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-health-retry-'));

  await writePlugin(
    root,
    'flaky',
    `
export const pluginManifest = {
  id: 'flaky',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.runtime': '^1.0.0' }
};
`,
    `
let attempts = 0;
export default () => {
  attempts += 1;
  if (attempts === 1) {
    throw new Error('temporary network timeout');
  }
  return () => {};
};
`
  );

  const runtime = createRuntime(root);
  const records = await runtime.start();
  assert.equal(records[0].state, 'active');

  const health = runtime.getInspector().health();
  const retry = health.recoveryActions.find((entry) => entry.strategy === 'retry activation');
  assert.ok(retry);
  assert.equal(retry.details.attempt, 1);
  assert.equal(retry.details.succeeded, true);
});

test('phase 22: dependency failure triggers deterministic cascade stop', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-health-cascade-'));

  await writePlugin(
    root,
    'provider',
    `
export const pluginManifest = {
  id: 'provider',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['provider:cap'],
  exportedCapabilities: {
    'provider:cap': () => ({ run: () => true })
  },
  consumedCapabilities: [],
  requiredPlatformContracts: {
    'plugin.registerCapability': '^1.0.0',
    'plugin.useCapability': '^1.0.0'
  }
};
`,
    `
export default ({ useCapability }) => {
  useCapability('missing:cap');
  return () => {};
};
`
  );

  await writePlugin(
    root,
    'consumer',
    `
export const pluginManifest = {
  id: 'consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  consumedCapabilities: ['provider:cap'],
  declaredCapabilities: [],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0'
  }
};
`
  );

  const runtime = createRuntime(root);
  await runtime.start();

  const health = runtime.getInspector().health();
  const cascade = health.recoveryActions.find((entry) => entry.strategy === 'dependency cascade stop');
  assert.ok(cascade);
  assert.deepEqual(cascade.details.affected, ['consumer']);
});

test('phase 22: unload clears plugin health after successful retry recovery', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-health-unload-'));

  await writePlugin(
    root,
    'flaky',
    `
export const pluginManifest = {
  id: 'flaky',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.runtime': '^1.0.0' }
};
`,
    `
let attempts = 0;
export default () => {
  attempts += 1;
  if (attempts === 1) {
    throw new Error('temporary network timeout');
  }
  return () => {};
};
`
  );

  const runtime = createRuntime(root);
  await runtime.start();

  assert.equal(runtime.getInspector().health().plugins.some((entry) => entry.pluginId === 'flaky'), true);
  const unloaded = await runtime.unload('flaky');
  assert.equal(unloaded, true);

  const health = runtime.getInspector().health();
  assert.equal(health.plugins.some((entry) => entry.pluginId === 'flaky'), false);
});
