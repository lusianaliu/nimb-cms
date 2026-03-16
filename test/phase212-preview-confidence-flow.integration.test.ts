import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase212-'));

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

test('phase 212: admin-only preview routes render draft pages and posts without exposing them publicly', async () => {
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
        title: 'Preview About',
        slug: 'preview-about',
        body: 'Private draft page body',
        workflowAction: 'save-draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createPageResponse.status, 302);

    const listPageResponse = await fetch(`http://127.0.0.1:${port}/admin/pages`, {
      headers: { cookie: authCookie }
    });
    const listPageHtml = await listPageResponse.text();
    const pageEditMatch = listPageHtml.match(/\/admin\/pages\/([^\/]+)\/edit/);
    assert.ok(pageEditMatch);

    const pageEditResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/${pageEditMatch[1]}/edit`, {
      headers: { cookie: authCookie }
    });
    const pageEditHtml = await pageEditResponse.text();
    assert.equal(pageEditResponse.status, 200);
    assert.equal(pageEditHtml.includes('/admin/preview/pages/'), true);
    const pagePreviewMatch = pageEditHtml.match(/\/admin\/preview\/pages\/([^"\s<]+)/);
    assert.ok(pagePreviewMatch);

    const publicPageResponse = await fetch(`http://127.0.0.1:${port}/preview-about`, { redirect: 'manual' });
    assert.equal(publicPageResponse.status, 404);

    const anonymousPagePreviewResponse = await fetch(`http://127.0.0.1:${port}/admin/preview/pages/${pagePreviewMatch[1]}`, { redirect: 'manual' });
    assert.equal(anonymousPagePreviewResponse.status, 302);
    assert.equal(anonymousPagePreviewResponse.headers.get('location'), '/admin/login');

    const authedPagePreviewResponse = await fetch(`http://127.0.0.1:${port}/admin/preview/pages/${pagePreviewMatch[1]}`, {
      headers: { cookie: authCookie }
    });
    const authedPagePreviewHtml = await authedPagePreviewResponse.text();
    assert.equal(authedPagePreviewResponse.status, 200);
    assert.equal(authedPagePreviewHtml.includes('Draft preview mode'), true);
    assert.equal(authedPagePreviewHtml.includes('Private draft page body'), true);

    const createPostResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Preview Launch',
        slug: 'preview-launch',
        body: 'Private draft post body',
        workflowAction: 'save-draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createPostResponse.status, 302);

    const listPostResponse = await fetch(`http://127.0.0.1:${port}/admin/posts`, {
      headers: { cookie: authCookie }
    });
    const listPostHtml = await listPostResponse.text();
    const postEditMatch = listPostHtml.match(/\/admin\/posts\/([^\/]+)\/edit/);
    assert.ok(postEditMatch);

    const postEditResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/${postEditMatch[1]}/edit`, {
      headers: { cookie: authCookie }
    });
    const postEditHtml = await postEditResponse.text();
    assert.equal(postEditResponse.status, 200);
    assert.equal(postEditHtml.includes('/admin/preview/posts/'), true);
    const postPreviewMatch = postEditHtml.match(/\/admin\/preview\/posts\/([^"\s<]+)/);
    assert.ok(postPreviewMatch);

    const publicPostResponse = await fetch(`http://127.0.0.1:${port}/blog/preview-launch`, { redirect: 'manual' });
    assert.equal(publicPostResponse.status, 404);

    const authedPostPreviewResponse = await fetch(`http://127.0.0.1:${port}/admin/preview/posts/${postPreviewMatch[1]}`, {
      headers: { cookie: authCookie }
    });
    const authedPostPreviewHtml = await authedPostPreviewResponse.text();
    assert.equal(authedPostPreviewResponse.status, 200);
    assert.equal(authedPostPreviewHtml.includes('Draft preview mode'), true);
    assert.equal(authedPostPreviewHtml.includes('Private draft post body'), true);
  } finally {
    await server.stop();
  }
});
