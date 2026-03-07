import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase120-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 120: post system supports CRUD and blog rendering', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const adminListPage = await fetch(`http://127.0.0.1:${port}/admin/posts`);
    assert.equal(adminListPage.status, 200);

    const adminCreatePage = await fetch(`http://127.0.0.1:${port}/admin/posts/new`);
    assert.equal(adminCreatePage.status, 200);

    const createResponse = await fetch(`http://127.0.0.1:${port}/admin-api/posts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Phase 120 Post',
        slug: 'phase-120-post',
        body: 'Initial post body',
        publishedAt: '2026-03-07T12:00:00.000Z'
      })
    });

    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.data.title, 'Phase 120 Post');

    const listResponse = await fetch(`http://127.0.0.1:${port}/admin-api/posts`);
    assert.equal(listResponse.status, 200);
    const posts = await listResponse.json();
    assert.equal(Array.isArray(posts), true);
    assert.equal(posts.length >= 1, true);

    const updateResponse = await fetch(`http://127.0.0.1:${port}/admin-api/posts/${encodeURIComponent(created.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Phase 120 Post Updated',
        slug: 'phase-120-post',
        body: 'Updated post body',
        publishedAt: '2026-03-08T08:30:00.000Z'
      })
    });

    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.data.title, 'Phase 120 Post Updated');

    const adminEditPage = await fetch(`http://127.0.0.1:${port}/admin/posts/${encodeURIComponent(created.id)}/edit`);
    assert.equal(adminEditPage.status, 200);

    const blogResponse = await fetch(`http://127.0.0.1:${port}/blog`);
    assert.equal(blogResponse.status, 200);
    const blogHtml = await blogResponse.text();
    assert.equal(blogHtml.includes('Phase 120 Post Updated'), true);

    const postResponse = await fetch(`http://127.0.0.1:${port}/blog/phase-120-post`);
    assert.equal(postResponse.status, 200);
    const postHtml = await postResponse.text();
    assert.equal(postHtml.includes('Updated post body'), true);

    const deleteResponse = await fetch(`http://127.0.0.1:${port}/admin-api/posts/${encodeURIComponent(created.id)}`, {
      method: 'DELETE'
    });
    assert.equal(deleteResponse.status, 204);
  } finally {
    await server.stop();
  }
});
