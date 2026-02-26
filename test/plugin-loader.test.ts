import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from '../core/events/event-bus.ts';
import { HookRegistry } from '../core/hooks/index.ts';
import { loadPlugins } from '../core/plugins/plugin-loader.ts';
import { CONTENT_CREATED_EVENT, type ContentEvents } from '../core/content/index.ts';

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
          hasHooks: Boolean(context?.hooks),
          hasLog: Boolean(context?.log)
        };
      }
    };
  `);

  const runtime = {
    hooks: new HookRegistry(new EventEmitter<ContentEvents>())
  };

  const loaded = await loadPlugins(runtime, { pluginsDirectory });
  const receivedContext = (globalThis as { receivedContext?: { hasHooks: boolean; hasLog: boolean } }).receivedContext;

  assert.deepEqual(loaded, ['alpha']);
  assert.deepEqual(receivedContext, { hasHooks: true, hasLog: true });
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
    hooks: new HookRegistry(new EventEmitter<ContentEvents>())
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
        globalThis.eventsSeen = 0;
        context.hooks.on('content.created', () => {
          globalThis.eventsSeen += 1;
        });
      }
    };
  `);

  const eventBus = new EventEmitter<ContentEvents>();
  const runtime = {
    hooks: new HookRegistry(eventBus)
  };

  await loadPlugins(runtime, { pluginsDirectory });

  eventBus.emit(CONTENT_CREATED_EVENT, {
    type: 'article',
    entry: { id: 'entry-1' } as never
  });

  assert.equal((globalThis as { eventsSeen?: number }).eventsSeen, 1);
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
        context.log.info('healthy loaded');
      }
    };
  `);

  const loggedErrors: string[] = [];
  const runtime = {
    hooks: new HookRegistry(new EventEmitter<ContentEvents>())
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
