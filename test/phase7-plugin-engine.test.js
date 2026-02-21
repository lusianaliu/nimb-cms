import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { EventBus } from '../src/core/events/event-bus.js';
import { HookSystem } from '../src/core/hooks/hook-system.js';
import { PluginLoader } from '../src/core/plugins/plugin-loader.js';
import { PluginRuntimeContext } from '../src/core/plugins/plugin-runtime-context.js';
import { PermissionRegistry } from '../src/core/authorization/permission-registry.js';
import { BlockRegistry } from '../src/core/content/blocks/block-registry.js';

class TestLogger {
  info() {}
  warn() {}
  error() {}
}

test('event bus dispatch executes async listeners and captures failures', async () => {
  const eventBus = new EventBus();
  const calls = [];

  eventBus.on('phase7.event', async () => {
    await Promise.resolve();
    calls.push('async-listener');
    return 'ok';
  });

  eventBus.on('phase7.event', () => {
    throw new Error('listener failure');
  });

  const outcomes = await eventBus.dispatch('phase7.event', { id: 1 });

  assert.equal(calls.length, 1);
  assert.equal(outcomes.length, 2);
  assert.equal(outcomes[0].ok, true);
  assert.equal(outcomes[1].ok, false);
});

test('hook system supports before/after and filter pipelines', async () => {
  const hooks = new HookSystem();
  const order = [];

  hooks.before('content.create', () => order.push('before'));
  hooks.after('content.create', () => order.push('after'));
  hooks.filter('content.title', (value) => `${value} v1`);
  hooks.filter('content.title', async (value) => `${value} v2`);

  await hooks.runBefore('content.create', {});
  await hooks.runAfter('content.create', {});
  const filtered = await hooks.applyFilters('content.title', 'Nimb', {});

  assert.deepEqual(order, ['before', 'after']);
  assert.equal(filtered, 'Nimb v1 v2');
});

test('plugin loader discovers plugins and runs register/boot lifecycle', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-phase7-'));
  const pluginsDirectory = path.join(tempRoot, 'plugins');
  const pluginDirectory = path.join(pluginsDirectory, 'example-plugin');
  await fs.mkdir(pluginDirectory, { recursive: true });

  await fs.writeFile(path.join(pluginDirectory, 'plugin.json'), JSON.stringify({
    id: 'example.plugin',
    name: 'Example Plugin',
    entry: 'index.js',
    enabled: true
  }));

  await fs.writeFile(path.join(pluginDirectory, 'index.js'), `
export default {
  register(context) {
    context.registerPermission({ key: 'plugin.example.read', description: 'read', source: 'example.plugin' });
    context.registerBlock({ type: 'example-banner', schema: { type: 'object', required: ['text'] }, version: 1 });
    context.registerRoute((req, res) => {
      if (req.url !== '/plugin/hello') return false;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return true;
    });
    context.on('plugin.event', () => 'heard');
    context.before('plugin.before', () => 'before');
    context.after('plugin.after', () => 'after');
    context.filter('plugin.filter', (value) => value + '-filtered');
  },
  boot() {
    globalThis.__phase7Booted = true;
  }
};
`);

  const routeHandlers = [];
  const router = {
    registerPluginRoute(handler) {
      routeHandlers.push(handler);
      return () => {};
    }
  };

  const eventBus = new EventBus();
  const hooks = new HookSystem();
  const permissionRegistry = new PermissionRegistry();
  const blockRegistry = new BlockRegistry();

  const loader = new PluginLoader({ pluginsDirectory, logger: new TestLogger() });
  await loader.discover();

  const context = new PluginRuntimeContext({
    eventBus,
    hooks,
    router,
    permissionRegistry,
    blockRegistry,
    logger: new TestLogger()
  });

  await loader.registerEnabled(context);
  await loader.bootEnabled(context);

  const dispatched = await eventBus.dispatch('plugin.event', {});
  const filtered = await hooks.applyFilters('plugin.filter', 'value', {});

  assert.equal(permissionRegistry.has('plugin.example.read'), true);
  assert.equal(blockRegistry.has('example-banner'), true);
  assert.equal(routeHandlers.length, 1);
  assert.equal(dispatched[0].ok, true);
  assert.equal(filtered, 'value-filtered');
  assert.equal(globalThis.__phase7Booted, true);

  assert.equal(loader.disable('example.plugin'), true);
  assert.equal(loader.enable('example.plugin'), true);

  delete globalThis.__phase7Booted;
  await fs.rm(tempRoot, { recursive: true, force: true });
});
