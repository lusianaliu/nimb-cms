import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-plugin-bootstrap-'));

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

test('bootstrap loads plugins and exposes hook registrations', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const pluginsDirectory = path.join(cwd, 'plugins', 'sample');
  fs.mkdirSync(pluginsDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginsDirectory, 'index.ts'), `
    export default {
      name: 'sample',
      setup(context) {
        context.log.info('config loaded', context.config);
        globalThis.pluginEventCount = 0;
        context.hooks.on('content.created', () => {
          globalThis.pluginEventCount += 1;
        });
      }
    };
  `);

  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  const runtime = bootstrap.runtime as { contentTypes: { register: (value: unknown) => void }; contentCommand: { create: (type: string, data: Record<string, unknown>) => Promise<unknown> } };

  runtime.contentTypes.register({
    name: 'Article',
    slug: 'article',
    fields: [{ name: 'title', type: 'string', required: true }]
  });

  await runtime.contentCommand.create('article', { title: 'plugin event' });

  assert.equal((globalThis as { pluginEventCount?: number }).pluginEventCount, 1);
});
