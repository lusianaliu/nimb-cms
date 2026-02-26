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

test('loadPlugins loads plugins and executes setup', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');

  writePlugin(pluginsDirectory, 'alpha', `
    export default {
      name: 'alpha',
      setup(runtime) {
        runtime.setupCount = (runtime.setupCount ?? 0) + 1;
      }
    };
  `);

  const runtime = {
    hooks: new HookRegistry(new EventEmitter<ContentEvents>()),
    setupCount: 0
  };

  const loaded = await loadPlugins(runtime, { pluginsDirectory });

  assert.deepEqual(loaded, ['alpha']);
  assert.equal(runtime.setupCount, 1);
});

test('loadPlugins registers hooks from plugin setup', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');

  writePlugin(pluginsDirectory, 'hooked', `
    export default {
      name: 'hooked',
      setup(runtime) {
        runtime.hooks.on('content.created', () => {
          runtime.eventsSeen = (runtime.eventsSeen ?? 0) + 1;
        });
      }
    };
  `);

  const eventBus = new EventEmitter<ContentEvents>();
  const runtime = {
    hooks: new HookRegistry(eventBus),
    eventsSeen: 0
  };

  await loadPlugins(runtime, { pluginsDirectory });

  eventBus.emit(CONTENT_CREATED_EVENT, {
    type: 'article',
    entry: { id: 'entry-1' } as never
  });

  assert.equal(runtime.eventsSeen, 1);
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
      setup(runtime) {
        runtime.healthyLoaded = true;
      }
    };
  `);

  const loggedErrors: string[] = [];
  const runtime = {
    hooks: new HookRegistry(new EventEmitter<ContentEvents>()),
    healthyLoaded: false
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
  assert.equal(runtime.healthyLoaded, true);
  assert.equal(loggedErrors.length, 1);
  assert.match(loggedErrors[0], /broken/);
});
