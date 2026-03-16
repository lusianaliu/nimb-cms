import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase148-'));

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

test('phase 148: content editing forms explain page/post purpose and preserve values on validation errors', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const pageFormResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      headers: { cookie: authCookie }
    });
    const pageFormHtml = await pageFormResponse.text();
    assert.equal(pageFormResponse.status, 200);
    assert.equal(pageFormHtml.includes('Pages are best for long-lived website content.'), true);
    assert.equal(pageFormHtml.includes('Page URL slug'), true);
    assert.equal(pageFormHtml.includes('Visibility'), true);

    const invalidPageResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: '',
        slug: 'about company',
        body: 'About body',
        status: 'draft'
      }).toString()
    });
    const invalidPageHtml = await invalidPageResponse.text();
    assert.equal(invalidPageResponse.status, 200);
    assert.equal(invalidPageHtml.includes('Please check the form'), true);
    assert.equal(invalidPageHtml.includes('about-company'), true);
    assert.equal(invalidPageHtml.includes('About body'), true);

    const pageCreateResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'About Company',
        slug: 'about-company',
        body: 'About body',
        status: 'published',
        workflowAction: 'save-draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(pageCreateResponse.status, 302);
    assert.equal(pageCreateResponse.headers.get('location'), '/admin/pages?notice=created-draft');

    const pageListResponse = await fetch(`http://127.0.0.1:${port}/admin/pages?notice=created-draft`, {
      headers: { cookie: authCookie }
    });
    const pageListHtml = await pageListResponse.text();
    assert.equal(pageListHtml.includes('Draft saved'), true);
    assert.equal(pageListHtml.includes('Draft'), true);

    const publishPostResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Launch Post',
        slug: 'launch-post',
        body: 'Launch details',
        status: 'draft',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(publishPostResponse.status, 302);
    assert.equal(publishPostResponse.headers.get('location'), '/admin/posts?notice=created-published');

    const postListResponse = await fetch(`http://127.0.0.1:${port}/admin/posts?notice=created-published`, {
      headers: { cookie: authCookie }
    });
    const postListHtml = await postListResponse.text();
    assert.equal(postListHtml.includes('Post published'), true);
    assert.equal(postListHtml.includes('Published'), true);

    const postFormResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      headers: { cookie: authCookie }
    });
    const postFormHtml = await postFormResponse.text();
    assert.equal(postFormResponse.status, 200);
    assert.equal(postFormHtml.includes('Posts are for articles and updates.'), true);
    assert.equal(postFormHtml.includes('Publish status'), true);

    const postCreateResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Release Notes',
        slug: '',
        body: 'Release notes body',
        status: 'published',
        publishedAt: 'bad-date'
      }).toString()
    });

    const invalidPostHtml = await postCreateResponse.text();
    assert.equal(postCreateResponse.status, 200);
    assert.equal(invalidPostHtml.includes('Failed to create post. Please review the form and try again.'), true);
    assert.equal(invalidPostHtml.includes('release-notes'), true);
    assert.equal(invalidPostHtml.includes('Release notes body'), true);
  } finally {
    await server.stop();
  }
});
