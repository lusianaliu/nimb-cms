import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

test('hook registry executes handlers in registration order', async () => {
  const hooks = new HookRegistry();
  hooks.register('content.create.transform', async (value: string) => `${value}-a`);
  hooks.register('content.create.transform', async (value: string) => `${value}-b`);

  const output = await hooks.execute('content.create.transform', 'seed', { type: 'article' });
  assert.equal(output, 'seed-a-b');
});

test('hook registry unsubscriber removes a handler', async () => {
  const hooks = new HookRegistry();
  const unsubscribe = hooks.register('content.create.transform', async (value: string) => `${value}-a`);
  unsubscribe();

  const output = await hooks.execute('content.create.transform', 'seed', { type: 'article' });
  assert.equal(output, 'seed');
});

test('hook registry rejects invalid lifecycle hook names', () => {
  const hooks = new HookRegistry();

  assert.throws(() => {
    hooks.register('invalid_hook_name', async (value: string) => value);
  }, /Invalid hook name/);
});

test('bootstrap runtime exposes lifecycle hooks API', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  const { runtime, hooks } = bootstrap;

  runtime.contentTypes.register({
    name: 'Article',
    slug: 'article',
    fields: [{ name: 'title', type: 'string', required: true }, { name: 'transformed', type: 'boolean' }]
  });

  hooks.register('content.create.transform', async (value: Record<string, unknown>) => ({
    ...value,
    transformed: true
  }));

  const created = await runtime.contentCommand.create('article', { title: 'hook test' });

  assert.deepEqual(created.data, { title: 'hook test', transformed: true });
  assert.equal(runtime.hooks, hooks);
});
