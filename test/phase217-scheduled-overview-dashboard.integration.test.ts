import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase217-'));

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

test('phase 217: dashboard shows a unified upcoming scheduled queue for pages and posts', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const createPageScheduled = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 217 Scheduled Page',
        slug: 'phase-217-scheduled-page',
        body: 'Page scheduled for dashboard queue.',
        status: 'published',
        publishedAt: '2999-01-01T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createPageScheduled.status, 302);

    const createPostScheduled = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 217 Scheduled Post',
        slug: 'phase-217-scheduled-post',
        body: 'Post scheduled for dashboard queue.',
        status: 'published',
        publishedAt: '2999-01-02T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createPostScheduled.status, 302);

    const createDraftPage = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 217 Draft Page',
        slug: 'phase-217-draft-page',
        body: 'Draft page should not show in scheduled queue.',
        status: 'published',
        publishedAt: '2999-01-03T09:00',
        workflowAction: 'save-draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createDraftPage.status, 302);

    const dashboard = await fetch(`http://127.0.0.1:${port}/admin`, {
      headers: { cookie: authCookie }
    });

    assert.equal(dashboard.status, 200);
    const html = await dashboard.text();

    assert.equal(html.includes('Upcoming scheduled content'), true);
    assert.equal(html.includes('Phase 217 Scheduled Page'), true);
    assert.equal(html.includes('Phase 217 Scheduled Post'), true);
    assert.equal(html.includes('Phase 217 Draft Page'), false);
    assert.equal(html.includes('<td>Page</td>'), true);
    assert.equal(html.includes('<td>Post</td>'), true);
    assert.equal(html.includes('2999-01-01 09:00'), true);
    assert.equal(html.includes('2999-01-02 09:00'), true);

    const pageIndex = html.indexOf('Phase 217 Scheduled Page');
    const postIndex = html.indexOf('Phase 217 Scheduled Post');
    assert.equal(pageIndex > -1, true);
    assert.equal(postIndex > -1, true);
    assert.equal(pageIndex < postIndex, true);

    const pagesApi = await fetch(`http://127.0.0.1:${port}/admin-api/pages`, {
      headers: { cookie: authCookie }
    });
    const pages = await pagesApi.json() as Array<{ id: string, data: { slug?: string } }>;
    const scheduledPage = pages.find((entry) => entry?.data?.slug === 'phase-217-scheduled-page');
    assert.equal(Boolean(scheduledPage?.id), true);

    const postsApi = await fetch(`http://127.0.0.1:${port}/admin-api/posts`, {
      headers: { cookie: authCookie }
    });
    const posts = await postsApi.json() as Array<{ id: string, data: { slug?: string } }>;
    const scheduledPost = posts.find((entry) => entry?.data?.slug === 'phase-217-scheduled-post');
    assert.equal(Boolean(scheduledPost?.id), true);

    assert.equal(html.includes(`/admin/pages/${encodeURIComponent(`${scheduledPage?.id ?? ''}`)}/edit`), true);
    assert.equal(html.includes(`/admin/posts/${encodeURIComponent(`${scheduledPost?.id ?? ''}`)}/edit`), true);
  } finally {
    await server.stop();
  }
});
