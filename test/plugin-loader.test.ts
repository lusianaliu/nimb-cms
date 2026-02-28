import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HookRegistry } from '../core/hooks/index.ts';
import { loadPlugins } from '../core/plugins/plugin-loader.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-plugin-loader-'));

const writePlugin = (pluginsDirectory: string, pluginName: string, source: string) => {
  const pluginDirectory = path.join(pluginsDirectory, pluginName);
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'index.ts'), source);
};

test('loadPlugins passes PluginContext to plugin setup', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');

  writePlugin(pluginsDirectory, 'alpha', `
    export default {
      name: 'alpha',
      setup(context) {
        globalThis.receivedContext = {
          config: context?.config,
          hasHooks: Boolean(context?.hooks),
          hasLog: Boolean(context?.log)
        };
      }
    };
  `);

  const runtime = {
    hooks: new HookRegistry()
  };

  const loaded = await loadPlugins(runtime, { pluginsDirectory });
  const receivedContext = (globalThis as {
    receivedContext?: { config: Record<string, unknown>; hasHooks: boolean; hasLog: boolean };
  }).receivedContext;

  assert.deepEqual(loaded, ['alpha']);
  assert.deepEqual(receivedContext, { config: {}, hasHooks: true, hasLog: true });
});

test('loadPlugins loads plugin config from config.json', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');

  writePlugin(pluginsDirectory, 'configured', `
    export default {
      name: 'configured',
      setup(context) {
        globalThis.receivedPluginConfig = context.config;
      }
    };
  `);

  fs.writeFileSync(path.join(pluginsDirectory, 'configured', 'config.json'), `${JSON.stringify({
    enabled: true,
    retries: 3,
    nested: { mode: 'strict' }
  }, null, 2)}\n`);

  const runtime = {
    hooks: new HookRegistry()
  };

  await loadPlugins(runtime, { pluginsDirectory });

  assert.deepEqual((globalThis as { receivedPluginConfig?: unknown }).receivedPluginConfig, {
    enabled: true,
    retries: 3,
    nested: { mode: 'strict' }
  });
});

test('loadPlugins uses empty config when plugin config.json is missing', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');

  writePlugin(pluginsDirectory, 'missing-config', `
    export default {
      name: 'missing-config',
      setup(context) {
        globalThis.missingConfigValue = context.config;
      }
    };
  `);

  const runtime = {
    hooks: new HookRegistry()
  };

  await loadPlugins(runtime, { pluginsDirectory });

  assert.deepEqual((globalThis as { missingConfigValue?: unknown }).missingConfigValue, {});
});

test('loadPlugins context logger prefixes plugin name', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');

  writePlugin(pluginsDirectory, 'logged', `
    export default {
      name: 'logged',
      setup(context) {
        context.log.info('hello');
      }
    };
  `);

  const runtime = {
    hooks: new HookRegistry()
  };

  const messages: string[] = [];
  const originalInfo = console.info;
  console.info = (message?: unknown, ...rest: unknown[]) => {
    messages.push([String(message), ...rest.map(String)].join(' '));
  };

  try {
    await loadPlugins(runtime, { pluginsDirectory });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(messages.length, 1);
  assert.match(messages[0], /^\[plugin:logged\] hello$/);
});

test('loadPlugins context hooks remain functional', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');

  writePlugin(pluginsDirectory, 'hooked', `
    export default {
      name: 'hooked',
      setup(context) {
        context.hooks.register('content.create.transform', async (value) => ({
          ...value,
          fromPlugin: true
        }));
      }
    };
  `);

  const runtime = {
    hooks: new HookRegistry()
  };

  await loadPlugins(runtime, { pluginsDirectory });

  const result = await runtime.hooks.execute('content.create.transform', { title: 'Article' }, { type: 'article' });

  assert.deepEqual(result, { title: 'Article', fromPlugin: true });
});

test('loadPlugins isolates plugin failures and continues loading', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');

  writePlugin(pluginsDirectory, 'broken', `
    export default {
      name: 'broken',
      setup() {
        throw new Error('boom');
      }
    };
  `);

  writePlugin(pluginsDirectory, 'healthy', `
    export default {
      name: 'healthy',
      setup(context) {
        context.log.info('config loaded', context.config);
      }
    };
  `);

  const loggedErrors: string[] = [];
  const runtime = {
    hooks: new HookRegistry()
  };

  const loaded = await loadPlugins(runtime, {
    pluginsDirectory,
    logger: {
      error(message, context) {
        loggedErrors.push(`${message}:${String(context?.plugin ?? '')}`);
      }
    }
  });

  assert.deepEqual(loaded, ['healthy']);
  assert.equal(loggedErrors.length, 1);
  assert.match(loggedErrors[0], /broken/);
});
