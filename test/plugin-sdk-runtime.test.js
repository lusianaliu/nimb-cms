import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { PluginRuntime } from '../core/runtime/plugin-runtime/lifecycle-runner.ts';
import { RuntimeContracts } from '../src/core/plugins/runtime-contracts.js';
import { definePlugin } from '../packages/plugin-sdk/index.ts';

class CaptureLogger {
  constructor() {
    this.entries = [];
  }

  info(message, metadata) {
    this.entries.push({ level: 'info', message, metadata });
  }

  warn(message, metadata) {
    this.entries.push({ level: 'warn', message, metadata });
  }

  error(message, metadata) {
    this.entries.push({ level: 'error', message, metadata });
  }
}

test('definePlugin validates required fields', () => {
  assert.throws(() => {
    definePlugin({
      name: '',
      version: '1.0.0'
    });
  }, /name/);

  assert.throws(() => {
    definePlugin({
      name: 'invalid-plugin',
      version: '1.0.0',
      lifecycle: {
        onStart: 'not-a-function'
      }
    });
  }, /lifecycle\.onStart/);
});

test('sdk example plugin loads and unloads through runtime contracts', async () => {
  const logger = new CaptureLogger();
  const contracts = new RuntimeContracts({ logger });
  const runtime = new PluginRuntime({
    pluginsDirectory: path.resolve(process.cwd(), 'plugins'),
    contracts: contracts.createContractSurface(),
    logger
  });

  const records = await runtime.start();
  const sdkRecord = records.find((record) => record.id === 'sdk-example-plugin');

  assert.ok(sdkRecord);
  assert.equal(sdkRecord.state, 'active');
  assert.equal(contracts.capabilities.has('example:read'), true);
  assert.equal(contracts.schemas.has('example.article'), true);
  assert.equal(contracts.lifecycleHooks.size > 0, true);

  const startLog = logger.entries.find((entry) => entry.message === 'sdk-example started');
  assert.ok(startLog);

  const unloaded = await runtime.unload('sdk-example-plugin');
  assert.equal(unloaded, true);

  const stopLog = logger.entries.find((entry) => entry.message === 'sdk-example stopped');
  assert.ok(stopLog);

  assert.equal(contracts.capabilities.has('example:read'), false);
  assert.equal(contracts.schemas.has('example.article'), false);
});
