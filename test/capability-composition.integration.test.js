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

const writePlugin = async (root, name, manifestBody, registerBody) => {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'manifest.ts'), manifestBody);
  await fs.writeFile(path.join(dir, 'register.ts'), registerBody);
};

const createRuntime = (pluginsDirectory) => {
  const logger = new TestLogger();
  const contracts = new RuntimeContracts({ logger });
  const runtime = new PluginRuntime({
    pluginsDirectory,
    contracts: contracts.createContractSurface(),
    logger
  });

  return { runtime };
};

test('capability resolution works through runtime context only', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-capability-'));

  await writePlugin(
    tempRoot,
    'a-provider-plugin',
    `
export const pluginManifest = {
  id: 'a-provider-plugin',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content:create'],
  exportedCapabilities: {
    'content:create': () => ({ create: async (payload = {}) => ({ ok: true, payload }) })
  },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`,
    `export const register = () => () => {};\nexport default register;`
  );

  await writePlugin(
    tempRoot,
    'z-consumer-plugin',
    `
export const pluginManifest = {
  id: 'z-consumer-plugin',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`,
    `
let capability;
export const register = (ctx) => {
  capability = ctx.useCapability('content:create');
  return () => {};
};
export const invoke = () => capability.create({ title: 'hello' });
export default register;
`
  );

  const { runtime } = createRuntime(tempRoot);
  const records = await runtime.start();
  assert.equal(records.every((record) => record.state === 'active'), true);

  const consumer = await import(path.join(tempRoot, 'z-consumer-plugin/register.ts'));
  const result = await consumer.invoke();
  assert.deepEqual(result, { ok: true, payload: { title: 'hello' } });
});

test('provider unload invalidates capability references', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-capability-unload-'));

  await writePlugin(
    tempRoot,
    'a-provider-plugin',
    `
export const pluginManifest = {
  id: 'a-provider-plugin',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content:create'],
  exportedCapabilities: {
    'content:create': () => ({ create: async () => ({ ok: true }) })
  },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`,
    `export const register = () => () => {};\nexport default register;`
  );

  await writePlugin(
    tempRoot,
    'z-consumer-plugin',
    `
export const pluginManifest = {
  id: 'z-consumer-plugin',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`,
    `
let capability;
export const register = (ctx) => {
  capability = ctx.useCapability('content:create');
  return () => {};
};
export const invoke = () => capability.create({});
export default register;
`
  );

  const { runtime } = createRuntime(tempRoot);
  await runtime.start();

  const consumer = await import(path.join(tempRoot, 'z-consumer-plugin/register.ts'));
  await runtime.unload('a-provider-plugin');

  await assert.rejects(() => consumer.invoke(), /inactive/);
});

test('duplicate capability providers can coexist without direct consumer dependency', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-capability-dupe-'));

  const providerManifest = (id) => `
export const pluginManifest = {
  id: '${id}',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['content:create'],
  exportedCapabilities: {
    'content:create': () => ({ create: async () => ({ provider: '${id}' }) })
  },
  requiredPlatformContracts: { 'plugin.registerCapability': '^1.0.0' }
};
`;

  await writePlugin(tempRoot, 'a-provider-plugin', providerManifest('a-provider-plugin'), `export const register = () => () => {};\nexport default register;`);
  await writePlugin(tempRoot, 'b-provider-plugin', providerManifest('b-provider-plugin'), `export const register = () => () => {};\nexport default register;`);
  await writePlugin(
    tempRoot,
    'z-consumer-plugin',
    `
export const pluginManifest = {
  id: 'z-consumer-plugin',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.useCapability': '^1.0.0' }
};
`,
    `export const register = () => () => {};\nexport default register;`
  );

  const { runtime } = createRuntime(tempRoot);
  const records = await runtime.start();

  const aProvider = records.find((record) => record.id === 'a-provider-plugin');
  const bProvider = records.find((record) => record.id === 'b-provider-plugin');
  const consumer = records.find((record) => record.id === 'z-consumer-plugin');

  assert.equal(aProvider?.state, 'active');
  assert.equal(bProvider?.state, 'active');
  assert.equal(consumer?.state, 'active');
});
