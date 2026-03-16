import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase214-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

const loginAsAdmin = async (port: number) => {
  const loginResponse = await fetch(`http://127.0.0.1:${port}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'admin@nimb.local', password: 'admin' }).toString(),
    redirect: 'manual'
  });

  assert.equal(loginResponse.status, 302);
  const cookie = (loginResponse.headers.get('set-cookie') ?? '').split(';')[0];
  assert.match(cookie, /^nimb_admin_session=/);
  return cookie;
};

test('phase 214: create-new forms support admin-only unsaved preview without persistence', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const pagesBefore = await fetch(`http://127.0.0.1:${port}/admin/pages`, { headers: { cookie: authCookie } });
    const pagesBeforeHtml = await pagesBefore.text();
    assert.equal((pagesBeforeHtml.match(/\/admin\/pages\/[^/]+\/edit/g) ?? []).length, 0);

    const postsBefore = await fetch(`http://127.0.0.1:${port}/admin/posts`, { headers: { cookie: authCookie } });
    const postsBeforeHtml = await postsBefore.text();
    assert.equal((postsBeforeHtml.match(/\/admin\/posts\/[^/]+\/edit/g) ?? []).length, 0);

    const pageNewResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, { headers: { cookie: authCookie } });
    const pageNewHtml = await pageNewResponse.text();
    assert.equal(pageNewHtml.includes('/admin/preview/pages/new/unsaved'), true);
    assert.equal(pageNewHtml.includes('Preview unsaved page'), true);

    const anonUnsavedPagePreview = await fetch(`http://127.0.0.1:${port}/admin/preview/pages/new/unsaved`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title: 'Anon New Page', slug: 'anon-new-page', body: 'Anon body' }).toString(),
      redirect: 'manual'
    });
    assert.equal(anonUnsavedPagePreview.status, 302);
    assert.equal(anonUnsavedPagePreview.headers.get('location'), '/admin/login');

    const unsavedPagePreview = await fetch(`http://127.0.0.1:${port}/admin/preview/pages/new/unsaved`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'New Unsaved Page Title',
        slug: 'new-unsaved-page',
        body: 'Unsaved new page body'
      }).toString()
    });
    const unsavedPageHtml = await unsavedPagePreview.text();
    assert.equal(unsavedPagePreview.status, 200);
    assert.equal(unsavedPageHtml.includes('Unsaved new page preview mode'), true);
    assert.equal(unsavedPageHtml.includes('Unsaved new page body'), true);

    const postNewResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, { headers: { cookie: authCookie } });
    const postNewHtml = await postNewResponse.text();
    assert.equal(postNewHtml.includes('/admin/preview/posts/new/unsaved'), true);
    assert.equal(postNewHtml.includes('Preview unsaved post'), true);

    const unsavedPostPreview = await fetch(`http://127.0.0.1:${port}/admin/preview/posts/new/unsaved`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'New Unsaved Post Title',
        slug: 'new-unsaved-post',
        body: 'Unsaved new post body',
        workflowAction: 'save-draft'
      }).toString()
    });
    const unsavedPostHtml = await unsavedPostPreview.text();
    assert.equal(unsavedPostPreview.status, 200);
    assert.equal(unsavedPostHtml.includes('Unsaved new post preview mode'), true);
    assert.equal(unsavedPostHtml.includes('Unsaved new post body'), true);

    const pagesAfter = await fetch(`http://127.0.0.1:${port}/admin/pages`, { headers: { cookie: authCookie } });
    const pagesAfterHtml = await pagesAfter.text();
    assert.equal((pagesAfterHtml.match(/\/admin\/pages\/[^/]+\/edit/g) ?? []).length, 0);

    const postsAfter = await fetch(`http://127.0.0.1:${port}/admin/posts`, { headers: { cookie: authCookie } });
    const postsAfterHtml = await postsAfter.text();
    assert.equal((postsAfterHtml.match(/\/admin\/posts\/[^/]+\/edit/g) ?? []).length, 0);

    const publicPage = await fetch(`http://127.0.0.1:${port}/new-unsaved-page`);
    assert.equal(publicPage.status, 404);

    const publicPost = await fetch(`http://127.0.0.1:${port}/blog/new-unsaved-post`);
    assert.equal(publicPost.status, 404);
  } finally {
    await server.stop();
  }
});
