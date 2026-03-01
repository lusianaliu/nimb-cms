import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase95-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '95.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const writePlugin = (cwd: string, pluginId: string, source: string) => {
  const directory = path.join(cwd, 'plugins', pluginId);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'plugin.json'), `${JSON.stringify({
    id: pluginId,
    name: pluginId,
    version: '1.0.0',
    entry: 'index.ts',
    apiVersion: '^1.0.0',
    capabilities: []
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'index.ts'), source);
};

test('phase 95: event system supports plugin collaboration with scoped runtime safety', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(
    cwd,
    'chapter-listener-a',
    `
      export default function register(api) {
        globalThis.phase95 = globalThis.phase95 ?? { calls: [], contexts: [], hasHooks: null, hasEvents: null, runtimeKeys: [] };
        globalThis.phase95.hasHooks = Boolean(api?.runtime?.hooks);
        globalThis.phase95.hasEvents = Boolean(api?.runtime?.events);
        globalThis.phase95.runtimeKeys = Object.keys(api?.runtime ?? {}).sort();

        api.runtime.events.on('chapter.published', async (payload, context) => {
          await new Promise((resolve) => setTimeout(resolve, 25));
          globalThis.phase95.calls.push(\`a:\${payload.chapterId}\`);
          globalThis.phase95.contexts.push(context);
        });
      }
    `
  );

  writePlugin(
    cwd,
    'chapter-listener-b',
    `
      export default function register(api) {
        globalThis.phase95 = globalThis.phase95 ?? { calls: [], contexts: [] };
        api.runtime.events.on('chapter.published', async (payload, context) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          globalThis.phase95.calls.push(\`b:\${payload.chapterId}\`);
          globalThis.phase95.contexts.push(context);
        });
      }
    `
  );

  writePlugin(
    cwd,
    'chapter-publisher',
    `
      export default function register(api) {
        globalThis.phase95 = globalThis.phase95 ?? { calls: [], contexts: [] };
        globalThis.phase95.publisherStartedAt = Date.now();
        globalThis.phase95.emitPromise = api.runtime.events.emit('chapter.published', { chapterId: 'ch-42' }).then(() => {
          globalThis.phase95.publisherFinishedAt = Date.now();
        });
      }
    `
  );

  await createBootstrap({ cwd, mode: 'runtime' });

  const phase95 = (globalThis as {
    phase95?: {
      calls?: string[];
      contexts?: Array<{ pluginId?: string; timestamp?: string }>;
      emitPromise?: Promise<void>;
      publisherStartedAt?: number;
      publisherFinishedAt?: number;
      hasHooks?: boolean;
      hasEvents?: boolean;
      runtimeKeys?: string[];
    };
  }).phase95;

  await phase95?.emitPromise;

  assert.equal(phase95?.hasHooks, true);
  assert.equal(phase95?.hasEvents, true);
  assert.deepEqual(phase95?.runtimeKeys, ['capabilities', 'events', 'hooks', 'plugins', 'settings']);

  assert.equal(Array.isArray(phase95?.calls), true);
  assert.equal(phase95?.calls?.length, 2);
  assert.deepEqual(new Set(phase95?.calls), new Set(['a:ch-42', 'b:ch-42']));

  const startedAt = phase95?.publisherStartedAt ?? 0;
  const finishedAt = phase95?.publisherFinishedAt ?? 0;
  assert.equal(finishedAt >= startedAt + 20, true);

  for (const context of phase95?.contexts ?? []) {
    assert.equal(context.pluginId, 'chapter-publisher');
    assert.equal(Number.isNaN(Date.parse(String(context.timestamp))), false);
    assert.deepEqual(Object.keys(context).sort(), ['pluginId', 'timestamp']);
  }
});

test('phase 95: event system validates dotted event names', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(
    cwd,
    'invalid-event-plugin',
    `
      export default function register(api) {
        api.runtime.events.on('invalid_event_name', () => {});
      }
    `
  );

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  assert.equal(bootstrap.runtime.plugins.list().length, 0);
});
