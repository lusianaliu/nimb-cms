import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PluginRuntime } from '../core/runtime/plugin-runtime/lifecycle-runner.ts';
import { RuntimeContracts } from '../src/core/plugins/runtime-contracts.js';

class CaptureLogger {
  constructor() {
    this.errors = [];
  }

  info() {}
  warn() {}
  error(message, metadata) {
    this.errors.push({ message, metadata });
  }
}

const writePlugin = async (root, name, manifestBody, registerBody) => {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'manifest.ts'), manifestBody);
  await fs.writeFile(path.join(dir, 'register.ts'), registerBody);
};

const createRuntime = (pluginsDirectory, logger = new CaptureLogger()) => {
  const contracts = new RuntimeContracts({ logger });
  const runtime = new PluginRuntime({
    pluginsDirectory,
    contracts: contracts.createContractSurface(),
    logger
  });

  return { runtime, logger };
};

test('event handlers execute in deterministic plugin load order and stable subscription order', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-events-order-'));

  await writePlugin(
    tempRoot,
    'a-publisher',
    `
export const pluginManifest = {
  id: 'a-publisher',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  exportedEvents: ['content:created'],
  requiredPlatformContracts: { 'plugin.emit': '^1.0.0' }
};
`,
    `
export const order = [];
export const register = (ctx) => {
  return async () => {
    await ctx.emit('content:created', { seq: 1 });
  };
};
export default register;
`
  );

  await writePlugin(
    tempRoot,
    'b-subscriber',
    `
export const pluginManifest = {
  id: 'b-subscriber',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.on': '^1.0.0' }
};
`,
    `
export const order = [];
export const register = (ctx) => {
  const offFirst = ctx.on('content:created', async () => { order.push('b:first'); });
  const offSecond = ctx.on('content:created', async () => { order.push('b:second'); });
  return () => { offSecond(); offFirst(); };
};
export default register;
`
  );

  await writePlugin(
    tempRoot,
    'c-subscriber',
    `
export const pluginManifest = {
  id: 'c-subscriber',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.on': '^1.0.0' }
};
`,
    `
export const order = [];
export const register = (ctx) => {
  const off = ctx.on('content:created', async () => { order.push('c:first'); });
  return () => off();
};
export default register;
`
  );

  const { runtime } = createRuntime(tempRoot);
  await runtime.start();
  await runtime.unload('a-publisher');

  const b = await import(path.join(tempRoot, 'b-subscriber/register.ts'));
  const c = await import(path.join(tempRoot, 'c-subscriber/register.ts'));
  assert.deepEqual([...b.order, ...c.order], ['b:first', 'b:second', 'c:first']);
});

test('event system unload cleanup invalidates stale handlers', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-events-unload-'));

  await writePlugin(
    tempRoot,
    'a-publisher',
    `
export const pluginManifest = {
  id: 'a-publisher',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  exportedEvents: ['content:created'],
  requiredPlatformContracts: { 'plugin.emit': '^1.0.0' }
};
`,
    `
export const register = (ctx) => {
  return async () => {
    await ctx.emit('content:created', { seq: 2 });
  };
};
export default register;
`
  );

  await writePlugin(
    tempRoot,
    'b-subscriber',
    `
export const pluginManifest = {
  id: 'b-subscriber',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.on': '^1.0.0' }
};
`,
    `
export const received = [];
export const register = (ctx) => {
  const off = ctx.on('content:created', async (payload) => { received.push(payload.seq); });
  return () => off();
};
export default register;
`
  );

  const { runtime } = createRuntime(tempRoot);
  await runtime.start();

  await runtime.unload('b-subscriber');
  await runtime.unload('a-publisher');

  const b = await import(path.join(tempRoot, 'b-subscriber/register.ts'));
  assert.deepEqual(b.received, []);
});

test('event subscriber failure is isolated and async handlers remain ordered', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-events-failure-'));

  await writePlugin(
    tempRoot,
    'a-publisher',
    `
export const pluginManifest = {
  id: 'a-publisher',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  exportedEvents: ['content:created'],
  requiredPlatformContracts: { 'plugin.emit': '^1.0.0' }
};
`,
    `
export const register = (ctx) => {
  return async () => {
    await Promise.all([
      ctx.emit('content:created', { id: 1 }),
      ctx.emit('content:created', { id: 2 })
    ]);
  };
};
export default register;
`
  );

  await writePlugin(
    tempRoot,
    'b-failing-subscriber',
    `
export const pluginManifest = {
  id: 'b-failing-subscriber',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.on': '^1.0.0' }
};
`,
    `
export const register = (ctx) => {
  const off = ctx.on('content:created', async () => {
    throw new Error('subscriber failed');
  });
  return () => off();
};
export default register;
`
  );

  await writePlugin(
    tempRoot,
    'c-async-subscriber',
    `
export const pluginManifest = {
  id: 'c-async-subscriber',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.on': '^1.0.0' }
};
`,
    `
export const received = [];
export const register = (ctx) => {
  const off = ctx.on('content:created', async (payload) => {
    await new Promise((resolve) => setTimeout(resolve, payload.id === 1 ? 20 : 5));
    received.push(payload.id);
  });
  return () => off();
};
export default register;
`
  );

  const { runtime, logger } = createRuntime(tempRoot);
  await runtime.start();
  await runtime.unload('a-publisher');

  const c = await import(path.join(tempRoot, 'c-async-subscriber/register.ts'));
  assert.deepEqual(c.received, [1, 2]);

  const failures = logger.errors.filter((entry) => entry.message === 'plugin.runtime.event.failure');
  assert.equal(failures.length, 1);
});
