import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from '../core/events/event-bus.ts';
import {
  CONTENT_CREATED_EVENT,
  CONTENT_UPDATED_EVENT,
  CONTENT_DELETED_EVENT,
  type ContentEvents
} from '../core/content/index.ts';
import { HookRegistry } from '../core/hooks/index.ts';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-hook-registry-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

test('hook registry receives emitted events', () => {
  const eventBus = new EventEmitter<ContentEvents>();
  const hooks = new HookRegistry(eventBus);
  const captured: Array<{ type: string; entryId: string }> = [];

  hooks.on(CONTENT_CREATED_EVENT, (payload) => {
    captured.push({ type: payload.type, entryId: payload.entry.id });
  });

  eventBus.emit(CONTENT_CREATED_EVENT, {
    type: 'article',
    entry: { id: 'entry-1' } as never
  });

  assert.deepEqual(captured, [{ type: 'article', entryId: 'entry-1' }]);
});

test('hook registry unsubscribe works', () => {
  const eventBus = new EventEmitter<ContentEvents>();
  const hooks = new HookRegistry(eventBus);
  let count = 0;

  const handler = () => {
    count += 1;
  };

  hooks.on(CONTENT_UPDATED_EVENT, handler);
  hooks.off(CONTENT_UPDATED_EVENT, handler);

  eventBus.emit(CONTENT_UPDATED_EVENT, {
    type: 'article',
    entry: { id: 'entry-1' } as never
  });

  assert.equal(count, 0);
});

test('hook registry supports multiple listeners for the same event', () => {
  const eventBus = new EventEmitter<ContentEvents>();
  const hooks = new HookRegistry(eventBus);
  const calls: string[] = [];

  hooks.on(CONTENT_DELETED_EVENT, () => {
    calls.push('listener-a');
  });

  hooks.on(CONTENT_DELETED_EVENT, () => {
    calls.push('listener-b');
  });

  eventBus.emit(CONTENT_DELETED_EVENT, {
    type: 'article',
    entry: { id: 'entry-1' } as never
  });

  assert.deepEqual(calls, ['listener-a', 'listener-b']);
});

test('bootstrap runtime exposes public hooks API', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  const { runtime, hooks } = bootstrap;

  runtime.contentTypes.register({
    name: 'Article',
    slug: 'article',
    fields: [{ name: 'title', type: 'string', required: true }]
  });

  let received = 0;
  hooks.on(CONTENT_CREATED_EVENT, () => {
    received += 1;
  });

  await runtime.contentCommand.create('article', { title: 'hook test' });

  assert.equal(received, 1);
  assert.equal(runtime.hooks, hooks);
});
