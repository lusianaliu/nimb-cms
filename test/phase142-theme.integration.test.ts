import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase142-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

test('phase 142: default frontend theme routes render homepage, blog list, post page, and page', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port, runtime } = await createInstalledServer({ cwd });

  try {
    runtime.db.create('post', {
      title: 'Hello World Post',
      slug: 'hello-world-post',
      content: 'Post body',
      status: 'published',
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedAt: new Date('2026-03-01T10:00:00.000Z')
    });

    runtime.db.create('page', {
      title: 'About Nimb',
      slug: 'about',
      content: 'Page body',
      status: 'published',
      createdAt: new Date('2026-03-02T10:00:00.000Z'),
      updatedAt: new Date('2026-03-02T10:00:00.000Z')
    });

    const homepageResponse = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(homepageResponse.status, 200);
    assert.equal((await homepageResponse.text()).includes('Welcome'), true);

    const blogListResponse = await fetch(`http://127.0.0.1:${port}/blog`);
    assert.equal(blogListResponse.status, 200);
    assert.equal((await blogListResponse.text()).includes('Hello World Post'), true);

    const postResponse = await fetch(`http://127.0.0.1:${port}/blog/hello-world-post`);
    assert.equal(postResponse.status, 200);
    assert.equal((await postResponse.text()).includes('Post body'), true);

    const pageResponse = await fetch(`http://127.0.0.1:${port}/about`);
    assert.equal(pageResponse.status, 200);
    assert.equal((await pageResponse.text()).includes('Page body'), true);
  } finally {
    await server.stop();
  }
});
