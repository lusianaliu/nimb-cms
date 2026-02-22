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

test('state store processes async updates sequentially in deterministic order', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-state-order-'));

  await writePlugin(
    tempRoot,
    'state-owner',
    `
export const pluginManifest = {
  id: 'state-owner',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: {
    'plugin.state.define': '^1.0.0',
    'plugin.state.update': '^1.0.0',
    'plugin.state.subscribe': '^1.0.0'
  }
};
`,
    `
export const snapshots = [];
export const register = (ctx) => {
  ctx.state.define('counter', { value: 0 });
  const off = ctx.state.subscribe('counter', async (value) => {
    await new Promise((resolve) => setTimeout(resolve, value.value === 1 ? 15 : 1));
    snapshots.push(value.value);
  });

  return async () => {
    await Promise.all([
      ctx.state.update('counter', async (current) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { value: current.value + 1 };
      }),
      ctx.state.update('counter', async (current) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { value: current.value + 1 };
      })
    ]);

    off();
  };
};
export default register;
`
  );

  const { runtime } = createRuntime(tempRoot);
  await runtime.start();
  await runtime.unload('state-owner');

  const owner = await import(path.join(tempRoot, 'state-owner/register.ts'));
  assert.deepEqual(owner.snapshots, [1, 2]);
});

test('state ownership is enforced and cross-plugin access happens through capability', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-state-ownership-'));

  await writePlugin(
    tempRoot,
    'a-state-provider',
    `
export const pluginManifest = {
  id: 'a-state-provider',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  exportedCapabilities: {
    'a-state-provider:counter': () => ({
      increment: async () => incrementRef(),
      read: () => readRef()
    })
  },
  requiredPlatformContracts: {
    'plugin.state.define': '^1.0.0',
    'plugin.state.update': '^1.0.0',
    'plugin.state.get': '^1.0.0'
  }
};
let incrementRef = async () => 0;
let readRef = () => ({ value: -1 });
export const bindCounterCapability = (increment, read) => {
  incrementRef = increment;
  readRef = read;
};
`,
    `
import { bindCounterCapability } from './manifest.ts';

export const register = (ctx) => {
  ctx.state.define('counter', { value: 0 });
  bindCounterCapability(
    async () => ctx.state.update('counter', (current) => ({ value: current.value + 1 })),
    () => ctx.state.get('counter')
  );
  return () => {};
};
export default register;
`
  );

  await writePlugin(
    tempRoot,
    'b-state-consumer',
    `
export const pluginManifest = {
  id: 'b-state-consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0',
    'plugin.state.update': '^1.0.0'
  }
};
`,
    `
export let directError = '';
export let readValue = -1;
export const register = (ctx) => {
  const counter = ctx.useCapability('a-state-provider:counter');
  return async () => {
    await counter.increment();
    readValue = (await counter.read()).value;
    try {
      await ctx.state.update('counter', (current) => current);
    } catch (error) {
      directError = error.message;
    }
  };
};
export default register;
`
  );

  const { runtime } = createRuntime(tempRoot);
  await runtime.start();
  await runtime.unload('b-state-consumer');

  const consumer = await import(path.join(tempRoot, 'b-state-consumer/register.ts'));
  assert.equal(consumer.readValue, 1);
  assert.match(consumer.directError, /is not defined for plugin b-state-consumer/);
});

test('state store cleanup on unload invalidates stale handlers', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-state-unload-'));

  await writePlugin(
    tempRoot,
    'state-owner',
    `
export const pluginManifest = {
  id: 'state-owner',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: {
    'plugin.state.define': '^1.0.0',
    'plugin.state.update': '^1.0.0'
  }
};
`,
    `
export let staleUpdater = async () => {};
export const register = (ctx) => {
  ctx.state.define('counter', { value: 0 });
  staleUpdater = async () => ctx.state.update('counter', (current) => ({ value: current.value + 1 }));
  return () => {};
};
export default register;
`
  );

  const { runtime } = createRuntime(tempRoot);
  await runtime.start();
  await runtime.unload('state-owner');

  const owner = await import(path.join(tempRoot, 'state-owner/register.ts'));
  await assert.rejects(() => owner.staleUpdater(), /is not defined for plugin state-owner/);
});

test('state update subscriber failures are isolated', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-state-failure-'));

  await writePlugin(
    tempRoot,
    'state-owner',
    `
export const pluginManifest = {
  id: 'state-owner',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: {
    'plugin.state.define': '^1.0.0',
    'plugin.state.update': '^1.0.0',
    'plugin.state.subscribe': '^1.0.0'
  }
};
`,
    `
export const seen = [];
export const register = (ctx) => {
  ctx.state.define('counter', { value: 0 });
  const offFail = ctx.state.subscribe('counter', async () => {
    throw new Error('subscriber failed');
  });
  const offPass = ctx.state.subscribe('counter', async (value) => {
    seen.push(value.value);
  });

  return async () => {
    await ctx.state.update('counter', (current) => ({ value: current.value + 1 }));
    offPass();
    offFail();
  };
};
export default register;
`
  );

  const { runtime, logger } = createRuntime(tempRoot);
  await runtime.start();
  await runtime.unload('state-owner');

  const owner = await import(path.join(tempRoot, 'state-owner/register.ts'));
  assert.deepEqual(owner.seen, [1]);
  const failures = logger.errors.filter((entry) => entry.message === 'plugin.runtime.state.subscriber.failure');
  assert.equal(failures.length, 1);
});
