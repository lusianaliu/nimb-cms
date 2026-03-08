import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase140-'));

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
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '140.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

test('phase 140: plugin sdk manifest and setup(runtime) contract loads and registers content features', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);

  const pluginDirectory = path.join(cwd, 'plugins', 'blog-format');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'manifest.json'), `${JSON.stringify({
    name: 'blog-format',
    version: '1.0.0',
    main: 'plugin.js'
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(pluginDirectory, 'plugin.js'), `
    export default {
      name: 'blog-format',
      setup(runtime) {
        runtime.fieldTypes.register({
          name: 'subtitle',
          validate: (value) => typeof value === 'string',
          serialize: (value) => String(value),
          deserialize: (value) => String(value),
          default: ''
        });

        runtime.contentTypes.register({
          name: 'Blog Article',
          slug: 'blog-article',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'subtitle', type: 'string' }
          ]
        });

        globalThis.phase140 = {
          setupRan: true,
          hasContentTypes: Boolean(runtime.contentTypes),
          hasFieldTypes: Boolean(runtime.fieldTypes),
          hasDb: Boolean(runtime.db),
          hasHooks: Boolean(runtime.hooks),
          hasHttp: Boolean(runtime.http)
        };
      }
    };
  `);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  const phase140 = (globalThis as {
    phase140?: {
      setupRan?: boolean;
      hasContentTypes?: boolean;
      hasFieldTypes?: boolean;
      hasDb?: boolean;
      hasHooks?: boolean;
      hasHttp?: boolean;
    }
  }).phase140;

  assert.equal(phase140?.setupRan, true);
  assert.equal(phase140?.hasContentTypes, true);
  assert.equal(phase140?.hasFieldTypes, true);
  assert.equal(phase140?.hasDb, true);
  assert.equal(phase140?.hasHooks, true);
  assert.equal(phase140?.hasHttp, true);

  const contentType = bootstrap.runtime.contentTypes.get('blog-article');
  assert.equal(contentType?.name, 'Blog Article');
  assert.equal(contentType?.fields.length, 2);

  const fieldType = bootstrap.runtime.fieldTypes.get('subtitle');
  assert.equal(fieldType?.validate('hello'), true);
  assert.equal(fieldType?.validate(42), false);

  assert.deepEqual(bootstrap.runtime.plugins.get('blog-format'), {
    id: 'blog-format',
    name: 'blog-format',
    version: '1.0.0',
    path: pluginDirectory,
    entry: path.join(pluginDirectory, 'plugin.js'),
    main: 'plugin.js',
    apiVersion: undefined,
    capabilities: []
  });
});
