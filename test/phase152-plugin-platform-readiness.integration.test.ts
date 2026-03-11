import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { loadPlugins } from '../core/plugin/plugin-loader.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase152-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '152.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

test('phase 152: plugin loader rejects entry paths outside plugin directory', async () => {
  const cwd = mkdtemp();
  const pluginsDirectory = path.join(cwd, 'plugins');
  const pluginDirectory = path.join(pluginsDirectory, 'unsafe');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'manifest.json'), `${JSON.stringify({
    name: 'unsafe',
    version: '1.0.0',
    main: '../escape.ts'
  }, null, 2)}\n`);

  const errors: string[] = [];
  const loaded = await loadPlugins({
    createScopedRuntime: () => Object.freeze({}),
    plugins: {
      get: () => undefined,
      list: () => [],
      register: () => undefined
    }
  }, {
    pluginsDirectory,
    logger: {
      error(message, context) {
        errors.push(`${message}:${String(context?.error ?? '')}`);
      }
    }
  });

  assert.deepEqual(loaded, []);
  assert.equal(errors.some((entry) => entry.includes('relative file path inside the plugin directory')), true);
});

test('phase 152: duplicate plugin routes fail with plugin-specific error context', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const firstPlugin = path.join(cwd, 'plugins', 'route-alpha');
  fs.mkdirSync(firstPlugin, { recursive: true });
  fs.writeFileSync(path.join(firstPlugin, 'manifest.json'), `${JSON.stringify({
    name: 'route-alpha',
    version: '1.0.0',
    main: 'index.ts'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(firstPlugin, 'index.ts'), `
    export default function register(api) {
      api.runtime.http.registerRoute('GET', '/plugin/collision', (_request, response) => {
        response.writeHead?.(200, { 'content-type': 'text/plain; charset=utf-8' });
        response.end?.('alpha');
      });
    }
  `);

  const secondPlugin = path.join(cwd, 'plugins', 'route-beta');
  fs.mkdirSync(secondPlugin, { recursive: true });
  fs.writeFileSync(path.join(secondPlugin, 'manifest.json'), `${JSON.stringify({
    name: 'route-beta',
    version: '1.0.0',
    main: 'index.ts'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(secondPlugin, 'index.ts'), `
    export default function register(api) {
      api.runtime.http.registerRoute('GET', '/plugin/collision', (_request, response) => {
        response.writeHead?.(200, { 'content-type': 'text/plain; charset=utf-8' });
        response.end?.('beta');
      });
    }
  `);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  assert.equal(bootstrap.runtime.plugins.get('route-alpha')?.id, 'route-alpha');
  assert.equal(bootstrap.runtime.plugins.get('route-beta'), undefined);
});

test('phase 152: starter canonical plugin contract loads and registers extensions', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const pluginDirectory = path.join(cwd, 'plugins', 'starter-canonical');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'manifest.json'), `${JSON.stringify({
    name: 'starter-canonical',
    version: '1.0.0',
    main: 'index.ts'
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(pluginDirectory, 'index.ts'), `
    export default function register(api) {
      api.runtime.fieldTypes.register({
        name: 'starter-note',
        validate: (value) => typeof value === 'string',
        serialize: (value) => String(value ?? ''),
        deserialize: (value) => String(value ?? ''),
        default: ''
      });

      api.runtime.contentTypes.register({
        name: 'Starter Note',
        slug: 'starter-note',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'note', type: 'starter-note' }
        ]
      });

      api.runtime.http.registerRoute('GET', '/plugin/starter-canonical/health', (_request, response) => {
        response.writeHead?.(200, { 'content-type': 'application/json; charset=utf-8' });
        response.end?.(JSON.stringify({ ok: true }));
      });

      api.runtime.admin.navRegistry.register({
        id: 'starter-canonical',
        label: 'Starter Plugin',
        path: '/admin/plugins/starter-canonical'
      });
    }
  `);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  assert.equal(bootstrap.runtime.plugins.get('starter-canonical')?.id, 'starter-canonical');
  assert.equal(bootstrap.runtime.fieldTypes.get('starter-note')?.name, 'starter-note');
  assert.equal(bootstrap.runtime.contentTypes.get('starter-note')?.slug, 'starter-note');
  assert.equal(bootstrap.runtime.admin.navRegistry.list().some((item) => item.id === 'starter-canonical'), true);
});
