import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { renderAdminNav } from '../core/admin/admin-nav.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase130-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '130.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const writePlugin = (cwd: string) => {
  const pluginDirectory = path.join(cwd, 'plugins', 'admin-menu-plugin');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'plugin.json'), `${JSON.stringify({
    name: 'admin-menu-plugin',
    version: '1.0.0',
    main: 'index.ts'
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(pluginDirectory, 'index.ts'), `
    export function activate(runtime) {
      runtime.hooks.registerHook('admin.menu', (menu) => {
        menu.register({
          id: 'forum',
          title: 'Forum',
          path: '/admin/forum',
          icon: 'chat'
        });
      });
    }
  `);
};

test('phase 130: plugin registers admin menu via admin.menu hook', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  writePlugin(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const menuItems = bootstrap.runtime.adminMenu.list();

  assert.deepEqual(menuItems, [{
    id: 'forum',
    title: 'Forum',
    path: '/admin/forum',
    icon: 'chat'
  }]);

  const html = renderAdminNav(bootstrap.runtime);
  assert.equal(html.includes('/admin/forum'), true);
  assert.equal(html.includes('Forum'), true);
});
