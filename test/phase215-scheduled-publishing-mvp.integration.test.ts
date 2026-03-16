import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase215-'));

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

test('phase 215: posts support scheduled publishing with clear status and visibility boundary', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const newPostResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      headers: { cookie: authCookie }
    });
    const newPostHtml = await newPostResponse.text();
    assert.equal(newPostResponse.status, 200);
    assert.equal(newPostHtml.includes('Published posts with a future publish date are scheduled and stay hidden until that time.'), true);
    assert.equal(newPostHtml.includes('Uses your server timezone.'), true);

    const createScheduled = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 215 Scheduled Post',
        slug: 'phase-215-scheduled-post',
        body: 'Scheduled content body.',
        status: 'published',
        publishedAt: '2999-01-01T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });

    assert.equal(createScheduled.status, 302);
    assert.equal(createScheduled.headers.get('location'), '/admin/posts?notice=created-scheduled');

    const scheduledListResponse = await fetch(`http://127.0.0.1:${port}/admin/posts?notice=created-scheduled`, {
      headers: { cookie: authCookie }
    });
    const scheduledListHtml = await scheduledListResponse.text();
    assert.equal(scheduledListResponse.status, 200);
    assert.equal(scheduledListHtml.includes('Post scheduled'), true);
    assert.equal(scheduledListHtml.includes('Scheduled'), true);
    assert.equal(scheduledListHtml.includes('2999-01-01 09:00'), true);

    const hiddenFromBlogList = await fetch(`http://127.0.0.1:${port}/blog`);
    const hiddenFromBlogListHtml = await hiddenFromBlogList.text();
    assert.equal(hiddenFromBlogList.status, 200);
    assert.equal(hiddenFromBlogListHtml.includes('Phase 215 Scheduled Post'), false);

    const hiddenFromBlogDetail = await fetch(`http://127.0.0.1:${port}/blog/phase-215-scheduled-post`);
    assert.equal(hiddenFromBlogDetail.status, 404);

    const postsApi = await fetch(`http://127.0.0.1:${port}/admin-api/posts`, {
      headers: { cookie: authCookie }
    });
    const posts = await postsApi.json() as Array<{ id: string, data: { slug?: string } }>;
    const scheduledPost = posts.find((entry) => entry?.data?.slug === 'phase-215-scheduled-post');
    assert.equal(Boolean(scheduledPost?.id), true);

    const publishNow = await fetch(`http://127.0.0.1:${port}/admin/posts/${encodeURIComponent(`${scheduledPost?.id ?? ''}`)}/edit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 215 Scheduled Post',
        slug: 'phase-215-scheduled-post',
        body: 'Scheduled content body now public.',
        status: 'published',
        publishedAt: '2000-01-01T09:00',
        workflowAction: 'publish-now'
      }).toString(),
      redirect: 'manual'
    });

    assert.equal(publishNow.status, 302);
    assert.equal(publishNow.headers.get('location'), '/admin/posts?notice=updated-published');

    const visibleBlogList = await fetch(`http://127.0.0.1:${port}/blog`);
    const visibleBlogListHtml = await visibleBlogList.text();
    assert.equal(visibleBlogList.status, 200);
    assert.equal(visibleBlogListHtml.includes('Phase 215 Scheduled Post'), true);

    const visibleBlogDetail = await fetch(`http://127.0.0.1:${port}/blog/phase-215-scheduled-post`);
    const visibleBlogDetailHtml = await visibleBlogDetail.text();
    assert.equal(visibleBlogDetail.status, 200);
    assert.equal(visibleBlogDetailHtml.includes('Scheduled content body now public.'), true);
  } finally {
    await server.stop();
  }
});
