import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase216-'));

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

test('phase 216: pages support scheduled publishing with matching status semantics and visibility boundaries', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const newPageResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      headers: { cookie: authCookie }
    });
    const newPageHtml = await newPageResponse.text();
    assert.equal(newPageResponse.status, 200);
    assert.equal(newPageHtml.includes('Published pages with a future publish date are scheduled and stay hidden until that time.'), true);
    assert.equal(newPageHtml.includes('Uses your server timezone.'), true);

    const createScheduled = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 216 Scheduled Page',
        slug: 'phase-216-scheduled-page',
        body: 'Scheduled page body.',
        status: 'published',
        publishedAt: '2999-01-01T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });

    assert.equal(createScheduled.status, 302);
    assert.equal(createScheduled.headers.get('location'), '/admin/pages?notice=created-scheduled');

    const scheduledListResponse = await fetch(`http://127.0.0.1:${port}/admin/pages?notice=created-scheduled`, {
      headers: { cookie: authCookie }
    });
    const scheduledListHtml = await scheduledListResponse.text();
    assert.equal(scheduledListResponse.status, 200);
    assert.equal(scheduledListHtml.includes('Page scheduled'), true);
    assert.equal(scheduledListHtml.includes('Scheduled'), true);
    assert.equal(scheduledListHtml.includes('2999-01-01 09:00'), true);

    const hiddenPage = await fetch(`http://127.0.0.1:${port}/phase-216-scheduled-page`);
    assert.equal(hiddenPage.status, 404);

    const homepage = await fetch(`http://127.0.0.1:${port}/`);
    const homepageHtml = await homepage.text();
    assert.equal(homepage.status, 200);
    assert.equal(homepageHtml.includes('/phase-216-scheduled-page'), false);

    const pagesApi = await fetch(`http://127.0.0.1:${port}/admin-api/pages`, {
      headers: { cookie: authCookie }
    });
    const pages = await pagesApi.json() as Array<{ id: string, data: { slug?: string } }>;
    const scheduledPage = pages.find((entry) => entry?.data?.slug === 'phase-216-scheduled-page');
    assert.equal(Boolean(scheduledPage?.id), true);

    const publishNow = await fetch(`http://127.0.0.1:${port}/admin/pages/${encodeURIComponent(`${scheduledPage?.id ?? ''}`)}/edit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 216 Scheduled Page',
        slug: 'phase-216-scheduled-page',
        body: 'Scheduled page body now public.',
        status: 'published',
        publishedAt: '2000-01-01T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });

    assert.equal(publishNow.status, 302);
    assert.equal(publishNow.headers.get('location'), '/admin/pages?notice=updated-published');

    const visiblePage = await fetch(`http://127.0.0.1:${port}/phase-216-scheduled-page`);
    const visiblePageHtml = await visiblePage.text();
    assert.equal(visiblePage.status, 200);
    assert.equal(visiblePageHtml.includes('Scheduled page body now public.'), true);
  } finally {
    await server.stop();
  }
});
