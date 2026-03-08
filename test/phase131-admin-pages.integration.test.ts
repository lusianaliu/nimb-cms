import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer } from './helpers/create-test-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase131-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const systemDir = path.join(cwd, 'data', 'system');
  fs.mkdirSync(systemDir, { recursive: true });
  fs.writeFileSync(path.join(systemDir, 'config.json'), `${JSON.stringify({ installed: true, version: '131.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
  fs.writeFileSync(path.join(cwd, 'data', 'install.lock'), 'installed\n');
};

const writePlugin = (cwd: string) => {
  const pluginDirectory = path.join(cwd, 'plugins', 'admin-page-plugin');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'plugin.json'), `${JSON.stringify({
    name: 'admin-page-plugin',
    version: '1.0.0',
    main: 'index.ts'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(pluginDirectory, 'index.ts'), `
    export function activate(runtime) {
      runtime.hooks.registerHook('admin.menu', (menu) => {
        menu.register({
          id: 'plugin-tools',
          title: 'Plugin Tools',
          path: '/admin/plugin-tools',
          icon: 'tool'
        });
      });

      runtime.hooks.registerHook('admin.page', (pages) => {
        pages.register({
          id: 'plugin-tools',
          path: '/admin/plugin-tools',
          title: 'Plugin Tools',
          render: () => '<h1>Plugin Tools</h1><p>Hello from plugin.</p>'
        });
      });
    }
  `);
};

test('phase 131: plugin registers admin page and request handler renders it', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  writePlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const response = await fetch(`http://127.0.0.1:${listening.port}/admin/plugin-tools`);
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.equal(html.includes('<div class="layout">'), true);
    assert.equal(html.includes('Nimb CMS'), true);
    assert.equal(html.includes('<a href="/admin/plugin-tools">'), true);
    assert.equal(html.includes('<h1>Plugin Tools</h1><p>Hello from plugin.</p>'), true);
  } finally {
    await started.server.stop();
  }
});
