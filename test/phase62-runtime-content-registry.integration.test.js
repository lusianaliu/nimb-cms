import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase62-'));

const writeConfig = (cwd) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
};

test('phase 62B: runtime exposes shared content type registry across lifecycle', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  const { runtime } = bootstrap;

  assert.ok(runtime.contentTypes);
  assert.equal(typeof runtime.contentTypes.register, 'function');

  runtime.contentTypes.register({
    name: 'Article',
    slug: 'article',
    fields: [
      { name: 'title', type: 'string', required: true }
    ]
  });

  assert.ok(runtime.contentTypes.get('article'));

  await runtime.start();

  const persistedType = runtime.contentTypes.get('article');
  assert.ok(persistedType);
  assert.equal(persistedType.slug, 'article');
  assert.equal(runtime.contentTypes.list().length, 1);
});
