import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { ContentRegistry } from '../core/content/content-registry.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase116-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

test('phase 116: registry registers and retrieves content types', () => {
  const registry = new ContentRegistry();

  registry.registerContentType({
    name: 'page',
    fields: {
      title: 'string',
      slug: 'string',
      body: 'text'
    }
  });

  const page = registry.getContentType('page');
  assert.ok(page);
  assert.deepEqual(page?.fields, {
    title: 'string',
    slug: 'string',
    body: 'text'
  });
  assert.equal(registry.listContentTypes().length, 1);
});

test('phase 116: runtime content API creates, retrieves, and lists content', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const { runtime } = bootstrap;

  const created = await runtime.content.create('page', {
    title: 'Welcome',
    slug: 'welcome',
    body: 'Hello Nimb'
  });

  assert.equal(created.type, 'page');
  assert.equal(created.data.title, 'Welcome');

  const fetched = runtime.content.get('page', created.id);
  assert.ok(fetched);
  assert.equal(fetched?.id, created.id);
  assert.equal(fetched?.data.slug, 'welcome');

  const listed = runtime.content.list('page');
  assert.equal(listed.length >= 1, true);
  assert.equal(listed.some((entry) => entry.id === created.id), true);

  const pageFile = path.join(cwd, 'data', 'content', 'page.json');
  assert.equal(fs.existsSync(pageFile), true);

  const persisted = JSON.parse(fs.readFileSync(pageFile, 'utf8')) as Array<Record<string, unknown>>;
  assert.equal(Array.isArray(persisted), true);
  assert.equal(persisted.some((entry) => entry.id === created.id && entry.slug === 'welcome'), true);
});
