import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase219-'));

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

test('phase 219: unified scheduled admin screen shows cross-type scheduled content with edit routes', async () => {
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
        title: 'Phase 219 Scheduled Page',
        slug: 'phase-219-scheduled-page',
        body: 'Scheduled page for unified screen.',
        status: 'published',
        publishedAt: '2999-03-02T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createScheduledPage.status, 302);

    const createScheduledPost = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 219 Scheduled Post',
        slug: 'phase-219-scheduled-post',
        body: 'Scheduled post for unified screen.',
        status: 'published',
        publishedAt: '2999-03-01T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createScheduledPost.status, 302);

    const createDraftPost = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 219 Draft Post',
        slug: 'phase-219-draft-post',
        body: 'Draft post should not appear in unified scheduled view.',
        workflowAction: 'save-draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(createDraftPost.status, 302);

    const scheduledResponse = await fetch(`http://127.0.0.1:${port}/admin/scheduled`, {
      headers: { cookie: authCookie }
    });
    assert.equal(scheduledResponse.status, 200);
    const scheduledHtml = await scheduledResponse.text();

    assert.equal(scheduledHtml.includes('Scheduled Content'), true);
    assert.equal(scheduledHtml.includes('Phase 219 Scheduled Page'), true);
    assert.equal(scheduledHtml.includes('Phase 219 Scheduled Post'), true);
    assert.equal(scheduledHtml.includes('Phase 219 Draft Post'), false);
    assert.equal(scheduledHtml.includes('/admin/pages/'), true);
    assert.equal(scheduledHtml.includes('/admin/posts/'), true);

    const postIndex = scheduledHtml.indexOf('Phase 219 Scheduled Post');
    const pageIndex = scheduledHtml.indexOf('Phase 219 Scheduled Page');
    assert.equal(postIndex >= 0, true);
    assert.equal(pageIndex >= 0, true);
    assert.equal(postIndex < pageIndex, true);

    const dashboardResponse = await fetch(`http://127.0.0.1:${port}/admin`, {
      headers: { cookie: authCookie }
    });
    assert.equal(dashboardResponse.status, 200);
    const dashboardHtml = await dashboardResponse.text();

    assert.equal(dashboardHtml.includes('/admin/scheduled'), true);
  } finally {
    await server.stop();
  }
});
