import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { PluginRuntime } from '../core/runtime/plugin-runtime/lifecycle-runner.ts';
import { RuntimeContracts } from '../src/core/plugins/runtime-contracts.js';

class TestLogger {
  info() {}
  warn() {}
  error() {}
}

test('plugin runtime discovers, loads, activates, and unloads content-basic plugin', async () => {
  const logger = new TestLogger();
  const runtimeContracts = new RuntimeContracts({ logger });
  const runtime = new PluginRuntime({
    pluginsDirectory: path.resolve(process.cwd(), 'plugins'),
    contracts: runtimeContracts.createContractSurface(),
    logger
  });

  const records = await runtime.start();
  const contentBasic = records.find((record) => record.id === 'content-basic');

  assert.ok(contentBasic);
  assert.equal(contentBasic.state, 'active');
  assert.equal(runtimeContracts.capabilities.size > 0, true);
  assert.equal(runtimeContracts.schemas.size > 0, true);
  assert.equal(runtimeContracts.lifecycleHooks.size > 0, true);

  const unloaded = await runtime.unload('content-basic');
  assert.equal(unloaded, true);
  assert.equal(runtimeContracts.capabilities.size, 0);
  assert.equal(runtimeContracts.schemas.size, 0);
  assert.equal(runtimeContracts.lifecycleHooks.size, 0);
});
