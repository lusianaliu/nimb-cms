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

test('runtime inspector provides deterministic read-only traces for events, capabilities, and state', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-observe-'));

  await writePlugin(
    tempRoot,
    'a-provider',
    `
export const pluginManifest = {
  id: 'a-provider',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: ['demo:capability'],
  exportedCapabilities: {
    'demo:capability': () => ({ execute: async () => ({ ok: true }) })
  },
  exportedEvents: ['demo:event'],
  requiredPlatformContracts: {
    'plugin.registerCapability': '^1.0.0',
    'plugin.emit': '^1.0.0',
    'plugin.state.define': '^1.0.0',
    'plugin.state.update': '^1.0.0'
  }
};
`,
    `
export const register = (ctx) => {
  ctx.state.define('counter', 0);

  return async () => {
    await ctx.state.update('counter', (current) => (current ?? 0) + 1);
    await ctx.emit('demo:event', { id: 1 });
  };
};
export default register;
`
  );

  await writePlugin(
    tempRoot,
    'b-consumer',
    `
export const pluginManifest = {
  id: 'b-consumer',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0',
    'plugin.on': '^1.0.0'
  }
};
`,
    `
export const received = [];
export const register = (ctx) => {
  const capability = ctx.useCapability('demo:capability');
  const off = ctx.on('demo:event', async () => {
    await capability.execute();
    received.push('event');
  });

  return () => off();
};
export default register;
`
  );

  const logger = new TestLogger();
  const runtimeContracts = new RuntimeContracts({ logger });
  const runtime = new PluginRuntime({
    pluginsDirectory: tempRoot,
    contracts: runtimeContracts.createContractSurface(),
    logger
  });

  await runtime.start();
  await runtime.unload('a-provider');

  const snapshot = runtime.getInspector().snapshot();
  assert.equal(Array.isArray(snapshot.plugins), true);

  assert.deepEqual(snapshot.eventTrace.map((entry) => ({
    eventName: entry.eventName,
    emitterPlugin: entry.emitterPlugin,
    subscriberPlugins: entry.subscriberPlugins
  })), [
    {
      eventName: 'demo:event',
      emitterPlugin: 'a-provider',
      subscriberPlugins: ['b-consumer']
    }
  ]);

  assert.deepEqual(snapshot.capabilityTrace.map((entry) => ({
    capabilityId: entry.capabilityId,
    providerPlugin: entry.providerPlugin,
    consumerPlugin: entry.consumerPlugin,
    result: entry.result
  })), [
    {
      capabilityId: 'demo:capability',
      providerPlugin: 'a-provider',
      consumerPlugin: 'b-consumer',
      result: 'resolved'
    },
    {
      capabilityId: 'demo:capability',
      providerPlugin: 'a-provider',
      consumerPlugin: 'b-consumer',
      result: 'success'
    }
  ]);

  assert.deepEqual(snapshot.stateTrace.map((entry) => ({
    pluginOwner: entry.pluginOwner,
    stateKey: entry.stateKey,
    updateSequenceId: entry.updateSequenceId
  })), [
    {
      pluginOwner: 'a-provider',
      stateKey: 'a-provider:counter',
      updateSequenceId: 1
    }
  ]);

  assert.equal(snapshot.diagnostics.length > 0, true);

  assert.throws(() => {
    snapshot.eventTrace.push({});
  }, /not extensible|read only|frozen/i);
});
