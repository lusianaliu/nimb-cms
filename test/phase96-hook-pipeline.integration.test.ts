import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase96-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '96.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const writePlugin = (cwd: string, pluginId: string, source: string, capabilities: string[] = ['content.write']) => {
  const directory = path.join(cwd, 'plugins', pluginId);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'plugin.json'), `${JSON.stringify({
    id: pluginId,
    name: pluginId,
    version: '1.0.0',
    entry: 'index.ts',
    capabilities
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'index.ts'), source);
};

test('phase 96: hooks execute in order with async chained transformations', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(cwd, 'hook-a', `
    export default function register(runtime) {
      runtime.hooks.register('content.create.transform', async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        globalThis.phase96Order = [...(globalThis.phase96Order ?? []), 'a'];
        return { ...value, title: String(value.title) + ' A' };
      });
    }
  `);

  writePlugin(cwd, 'hook-b', `
    export default function register(runtime) {
      runtime.hooks.register('content.create.transform', async (value) => {
        globalThis.phase96Order = [...(globalThis.phase96Order ?? []), 'b'];
        return { ...value, slug: String(value.title).toLowerCase().replace(/\\s+/g, '-') };
      });
    }
  `);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  bootstrap.runtime.contentTypes.register({ name: 'Article', slug: 'article', fields: [{ name: 'title', type: 'string' }, { name: 'slug', type: 'string' }] });

  const created = await bootstrap.runtime.contentCommand.create('article', { title: 'Hello' });

  assert.deepEqual((globalThis as { phase96Order?: string[] }).phase96Order, ['a', 'b']);
  assert.deepEqual(created.data, { title: 'Hello A', slug: 'hello-a' });
});

test('phase 96: hook execution errors are isolated with descriptive messages', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(cwd, 'broken-transform', `
    export default function register(runtime) {
      runtime.hooks.register('content.create.transform', async () => {
        throw new Error('transform failed');
      });
    }
  `);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  await assert.rejects(
    () => bootstrap.runtime.hooks.execute('content.create.transform', { title: 'x' }, { type: 'article' }),
    /Hook execution failed for "content.create.transform" at handler #1 plugin "broken-transform": transform failed/
  );
});

test('phase 96: invalid hook names are rejected', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(cwd, 'invalid-name', `
    export default function register(runtime) {
      runtime.hooks.register('content.create', async (value) => value);
    }
  `);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  assert.equal(bootstrap.runtime.plugins.list().length, 0);
});

test('phase 96: plugins cannot register hooks outside allowed domains', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  writePlugin(
    cwd,
    'settings-plugin',
    `
      export default function register(runtime) {
        runtime.hooks.register('content.create.transform', async (value) => value);
      }
    `,
    ['settings.write']
  );

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  assert.equal(bootstrap.runtime.plugins.list().length, 0);
});
