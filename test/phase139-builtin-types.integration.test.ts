import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase139-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 139: built-in content types support post/page/media create and post query', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const { runtime } = bootstrap;

  assert.ok(runtime.contentTypes.get('post'));
  assert.ok(runtime.contentTypes.get('page'));
  assert.ok(runtime.contentTypes.get('media'));

  const post = await runtime.contentCommand.create('post', {
    title: 'Hello post',
    slug: 'hello-post',
    content: { blocks: [{ type: 'paragraph', text: 'Body' }] },
    excerpt: 'Summary',
    status: 'published',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  });
  assert.equal(post.type, 'post');
  assert.equal(post.data.title, 'Hello post');

  const posts = runtime.contentQuery.list('post');
  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.data.slug, 'hello-post');

  const page = await runtime.contentCommand.create('page', {
    title: 'About',
    slug: 'about',
    content: { blocks: [] },
    status: 'draft',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z')
  });
  assert.equal(page.type, 'page');
  assert.equal(page.data.slug, 'about');

  const media = await runtime.contentCommand.create('media', {
    filename: 'logo.png',
    path: '/uploads/logo.png',
    mime: 'image/png',
    size: 2048,
    createdAt: new Date('2026-01-03T00:00:00.000Z')
  });
  assert.equal(media.type, 'media');
  assert.equal(media.data.mime, 'image/png');

  const adminContentRoutes = runtime.contentTypes
    .list()
    .map((definition) => `/admin/content/${definition.slug}`);

  assert.equal(adminContentRoutes.includes('/admin/content/post'), true);
  assert.equal(adminContentRoutes.includes('/admin/content/page'), true);
  assert.equal(adminContentRoutes.includes('/admin/content/media'), true);
});
