import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAdminNavRegistry } from '../core/admin/admin-nav-registry.ts';
import { renderAdminNav } from '../core/admin/admin-nav.ts';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase102-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '102.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const withInstallState = async (run: () => Promise<void> | void) => {
  const previousContent = fs.existsSync(INSTALL_STATE_PATH)
    ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8')
    : null;

  try {
    await run();
  } finally {
    if (previousContent === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousContent, 'utf8');
    }
  }
};

test('phase 102: admin nav registry enforces unique ids and sorts by order', () => {
  const registry = createAdminNavRegistry();
  registry.register({ id: 'zeta', label: 'Zeta', path: '/admin/z' });
  registry.register({ id: 'alpha', label: 'Alpha', path: '/admin/a', order: 5 });
  registry.register({ id: 'beta', label: 'Beta', path: '/admin/b', order: 5 });

  const listed = registry.list();
  assert.deepEqual(listed.map((item) => item.id), ['alpha', 'beta', 'zeta']);
  assert.equal(listed[2]?.order, 100);

  assert.throws(
    () => registry.register({ id: 'alpha', label: 'Duplicate', path: '/admin/duplicate' }),
    /Admin nav item already exists/
  );
});

test('phase 102: admin nav renderer renders registered items and filters by capability', () => {
  const registry = createAdminNavRegistry();
  registry.register({ id: 'content', label: 'Content', path: '/admin/content/page', order: 10 });
  registry.register({ id: 'secret', label: '<Secret>', path: '/admin/secret', order: 20, capability: 'admin.secret' });

  const runtime = {
    admin: { navRegistry: registry },
    auth: {
      hasCapability: (capability: string) => capability !== 'admin.secret'
    }
  };

  const html = renderAdminNav(runtime, 'content');
  assert.equal(html.includes('<a href="/admin/content/page" aria-current="page" class="is-active">Content</a>'), true);
  assert.equal(html.includes('/admin/secret'), false);

  const escaped = renderAdminNav({
    admin: { navRegistry: Object.freeze({ list: () => [{ id: 'x', label: '<X>', path: '/admin/x?y=<z>' }] }) }
  }, 'x');
  assert.equal(escaped.includes('&lt;X&gt;'), true);
  assert.equal(escaped.includes('/admin/x?y=&lt;z&gt;'), true);
});

test('phase 102: bootstrap emits admin.nav.register and plugins can register nav items', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '102.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const pluginDir = path.join(cwd, 'plugins', 'admin-nav-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), `${JSON.stringify({
      id: 'admin-nav-plugin',
      name: 'admin-nav-plugin',
      version: '1.0.0',
      entry: 'index.ts',
      apiVersion: '^1.0.0',
      capabilities: []
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(pluginDir, 'index.ts'), `
      export default function register(api) {
        api.runtime.events.on('admin.nav.register', () => {
          const baseItems = [
            { id: 'dashboard', label: 'Dashboard', path: '/admin', order: 10 },
            { id: 'posts', label: 'Posts', path: '/admin/posts', order: 20 },
            { id: 'media', label: 'Media', path: '/admin/media', order: 30 },
            { id: 'pages', label: 'Pages', path: '/admin/pages', order: 40 },
            { id: 'settings', label: 'Settings', path: '/admin/settings', order: 50 }
          ];

          for (const item of baseItems) {
            if (!api.runtime.admin.navRegistry.list().some((existing) => existing.id === item.id)) {
              api.runtime.admin.navRegistry.register(item);
            }
          }

          api.runtime.admin.navRegistry.register({
            id: 'plugin-tools',
            label: 'Plugin Tools',
            path: '/admin/plugins/tools',
            order: 60
          });
        });
      }
    `);

    const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
    const navIds = bootstrap.runtime.admin.navRegistry.list().map((item) => item.id);

    assert.equal(navIds.includes('dashboard'), true);
    assert.equal(navIds.includes('posts'), true);
    assert.equal(navIds.includes('media'), true);
    assert.equal(navIds.includes('pages'), true);
    assert.equal(navIds.includes('settings'), true);
    assert.equal(navIds.includes('plugin-tools'), true);
  });
});
