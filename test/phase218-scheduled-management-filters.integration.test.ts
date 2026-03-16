import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase218-'));

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

test('phase 218: pages and posts provide scheduled-only management filters', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const createScheduledPage = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 218 Scheduled Page',
        slug: 'phase-218-scheduled-page',
        body: 'Scheduled page for filter checks.',
        status: 'published',
        publishedAt: '2999-02-01T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createScheduledPage.status, 302);

    const createDraftPage = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 218 Draft Page',
        slug: 'phase-218-draft-page',
        body: 'Draft page should not appear in scheduled filter.',
        workflowAction: 'save-draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createDraftPage.status, 302);

    const createScheduledPost = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 218 Scheduled Post',
        slug: 'phase-218-scheduled-post',
        body: 'Scheduled post for filter checks.',
        status: 'published',
        publishedAt: '2999-02-02T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createScheduledPost.status, 302);

    const createPublishedPost = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 218 Published Post',
        slug: 'phase-218-published-post',
        body: 'Published post should not appear in scheduled filter.',
        status: 'published',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createPublishedPost.status, 302);

    const pagesFilteredResponse = await fetch(`http://127.0.0.1:${port}/admin/pages?filter=scheduled`, {
      headers: { cookie: authCookie }
    });
    assert.equal(pagesFilteredResponse.status, 200);
    const pagesFilteredHtml = await pagesFilteredResponse.text();

    assert.equal(pagesFilteredHtml.includes('Scheduled only'), true);
    assert.equal(pagesFilteredHtml.includes('Shows pages currently in scheduled state'), true);
    assert.equal(pagesFilteredHtml.includes('Phase 218 Scheduled Page'), true);
    assert.equal(pagesFilteredHtml.includes('Phase 218 Draft Page'), false);

    const postsFilteredResponse = await fetch(`http://127.0.0.1:${port}/admin/posts?filter=scheduled`, {
      headers: { cookie: authCookie }
    });
    assert.equal(postsFilteredResponse.status, 200);
    const postsFilteredHtml = await postsFilteredResponse.text();

    assert.equal(postsFilteredHtml.includes('Scheduled only'), true);
    assert.equal(postsFilteredHtml.includes('Shows posts currently in scheduled state'), true);
    assert.equal(postsFilteredHtml.includes('Phase 218 Scheduled Post'), true);
    assert.equal(postsFilteredHtml.includes('Phase 218 Published Post'), false);

    const dashboardResponse = await fetch(`http://127.0.0.1:${port}/admin`, {
      headers: { cookie: authCookie }
    });
    assert.equal(dashboardResponse.status, 200);
    const dashboardHtml = await dashboardResponse.text();

    assert.equal(dashboardHtml.includes('/admin/pages?filter=scheduled'), true);
    assert.equal(dashboardHtml.includes('/admin/posts?filter=scheduled'), true);
  } finally {
    await server.stop();
  }
});
