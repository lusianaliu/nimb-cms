import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase213-'));

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

test('phase 213: unsaved page/post preview renders current buffer for admins without persistence', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const createPageResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Saved About',
        slug: 'saved-about',
        body: 'Saved page body',
        workflowAction: 'save-draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createPageResponse.status, 302);

    const pagesResponse = await fetch(`http://127.0.0.1:${port}/admin/pages`, { headers: { cookie: authCookie } });
    const pagesHtml = await pagesResponse.text();
    const pageEditMatch = pagesHtml.match(/\/admin\/pages\/([^/]+)\/edit/);
    assert.ok(pageEditMatch);

    const pageEditResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/${pageEditMatch[1]}/edit`, { headers: { cookie: authCookie } });
    const pageEditHtml = await pageEditResponse.text();
    assert.equal(pageEditHtml.includes('/admin/preview/pages/'), true);
    assert.equal(pageEditHtml.includes('/unsaved'), true);

    const anonUnsavedPageResponse = await fetch(`http://127.0.0.1:${port}/admin/preview/pages/${pageEditMatch[1]}/unsaved`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title: 'Anon', slug: 'saved-about', body: 'Anon body' }).toString(),
      redirect: 'manual'
    });
    assert.equal(anonUnsavedPageResponse.status, 302);
    assert.equal(anonUnsavedPageResponse.headers.get('location'), '/admin/login');

    const unsavedPageResponse = await fetch(`http://127.0.0.1:${port}/admin/preview/pages/${pageEditMatch[1]}/unsaved`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Unsaved About Title',
        slug: 'saved-about',
        body: 'Unsaved page preview body'
      }).toString()
    });
    const unsavedPageHtml = await unsavedPageResponse.text();
    assert.equal(unsavedPageResponse.status, 200);
    assert.equal(unsavedPageHtml.includes('Unsaved preview mode'), true);
    assert.equal(unsavedPageHtml.includes('Unsaved page preview body'), true);

    const savedPagePreviewResponse = await fetch(`http://127.0.0.1:${port}/admin/preview/pages/${pageEditMatch[1]}`, {
      headers: { cookie: authCookie }
    });
    const savedPagePreviewHtml = await savedPagePreviewResponse.text();
    assert.equal(savedPagePreviewHtml.includes('Saved page body'), true);
    assert.equal(savedPagePreviewHtml.includes('Unsaved page preview body'), false);

    const createPostResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Saved Launch',
        slug: 'saved-launch',
        body: 'Saved post body',
        workflowAction: 'save-draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createPostResponse.status, 302);

    const postsResponse = await fetch(`http://127.0.0.1:${port}/admin/posts`, { headers: { cookie: authCookie } });
    const postsHtml = await postsResponse.text();
    const postEditMatch = postsHtml.match(/\/admin\/posts\/([^/]+)\/edit/);
    assert.ok(postEditMatch);

    const unsavedPostResponse = await fetch(`http://127.0.0.1:${port}/admin/preview/posts/${postEditMatch[1]}/unsaved`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Unsaved Launch Title',
        slug: 'saved-launch',
        body: 'Unsaved post preview body',
        workflowAction: 'publish-now'
      }).toString()
    });
    const unsavedPostHtml = await unsavedPostResponse.text();
    assert.equal(unsavedPostResponse.status, 200);
    assert.equal(unsavedPostHtml.includes('Unsaved preview mode'), true);
    assert.equal(unsavedPostHtml.includes('Unsaved post preview body'), true);

    const savedPostPreviewResponse = await fetch(`http://127.0.0.1:${port}/admin/preview/posts/${postEditMatch[1]}`, {
      headers: { cookie: authCookie }
    });
    const savedPostPreviewHtml = await savedPostPreviewResponse.text();
    assert.equal(savedPostPreviewHtml.includes('Saved post body'), true);
    assert.equal(savedPostPreviewHtml.includes('Unsaved post preview body'), false);
  } finally {
    await server.stop();
  }
});
