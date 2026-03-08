import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase128-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '128.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

test('phase 128: plugin registers system.start hook and executes on runtime bootstrap', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const pluginDirectory = path.join(cwd, 'plugins', 'hook-plugin');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'plugin.json'), `${JSON.stringify({
    name: 'hook-plugin',
    version: '1.0.0',
    main: 'index.ts'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(pluginDirectory, 'index.ts'), `
    export function activate(runtime) {
      runtime.hooks.registerHook('system.start', () => {
        globalThis.phase128 = {
          hookExecuted: true
        };
      });
    }
  `);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  const phase128 = (globalThis as {
    phase128?: { hookExecuted?: boolean }
  }).phase128;

  assert.deepEqual(phase128, { hookExecuted: true });
  assert.equal(typeof bootstrap.runtime.hooks.registerHook, 'function');
  assert.deepEqual(bootstrap.runtime.hooks.supportedHooks, [
    'system.start',
    'routes.register',
    'admin.menu',
    'admin.page',
    'editor.extend',
    'content.field',
    'content.type',
    'content-type.register'
  ]);
});
