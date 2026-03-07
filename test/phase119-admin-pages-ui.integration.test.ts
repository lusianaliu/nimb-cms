import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase119-'));

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

test('phase 119: admin pages UI supports listing, creating, editing, and deleting pages', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const emptyListResponse = await fetch(`http://127.0.0.1:${port}/admin/pages`, {
      headers: { cookie: authCookie }
    });

    assert.equal(emptyListResponse.status, 200);
    const emptyListHtml = await emptyListResponse.text();
    assert.equal(emptyListHtml.includes('<h1>Pages</h1>'), true);
    assert.equal(emptyListHtml.includes('Create Page'), true);

    const createResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 119 Home',
        slug: 'phase-119-home',
        body: 'Created from admin pages UI'
      }).toString(),
      redirect: 'manual'
    });

    assert.equal(createResponse.status, 302);
    assert.equal(createResponse.headers.get('location'), '/admin/pages');

    const listAfterCreateResponse = await fetch(`http://127.0.0.1:${port}/admin/pages`, {
      headers: { cookie: authCookie }
    });

    assert.equal(listAfterCreateResponse.status, 200);
    const listAfterCreateHtml = await listAfterCreateResponse.text();
    assert.equal(listAfterCreateHtml.includes('Phase 119 Home'), true);
    assert.equal(listAfterCreateHtml.includes('phase-119-home'), true);

    const editLinkMatch = listAfterCreateHtml.match(/href="\/admin\/pages\/([^/]+)\/edit"/);
    assert.ok(editLinkMatch);
    const pageId = decodeURIComponent(editLinkMatch?.[1] ?? '');

    const editFormResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/${encodeURIComponent(pageId)}/edit`, {
      headers: { cookie: authCookie }
    });

    assert.equal(editFormResponse.status, 200);
    const editFormHtml = await editFormResponse.text();
    assert.equal(editFormHtml.includes('Edit Page'), true);
    assert.equal(editFormHtml.includes('phase-119-home'), true);

    const updateResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/${encodeURIComponent(pageId)}/edit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'Phase 119 Home Updated',
        slug: 'phase-119-home-updated',
        body: 'Updated from admin pages UI'
      }).toString(),
      redirect: 'manual'
    });

    assert.equal(updateResponse.status, 302);
    assert.equal(updateResponse.headers.get('location'), '/admin/pages');

    const listAfterUpdateResponse = await fetch(`http://127.0.0.1:${port}/admin/pages`, {
      headers: { cookie: authCookie }
    });

    assert.equal(listAfterUpdateResponse.status, 200);
    const listAfterUpdateHtml = await listAfterUpdateResponse.text();
    assert.equal(listAfterUpdateHtml.includes('Phase 119 Home Updated'), true);
    assert.equal(listAfterUpdateHtml.includes('phase-119-home-updated'), true);

    const deleteResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/${encodeURIComponent(pageId)}/delete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      redirect: 'manual'
    });

    assert.equal(deleteResponse.status, 302);
    assert.equal(deleteResponse.headers.get('location'), '/admin/pages');

    const listAfterDeleteResponse = await fetch(`http://127.0.0.1:${port}/admin/pages`, {
      headers: { cookie: authCookie }
    });

    assert.equal(listAfterDeleteResponse.status, 200);
    const listAfterDeleteHtml = await listAfterDeleteResponse.text();
    assert.equal(listAfterDeleteHtml.includes('Phase 119 Home Updated'), false);

    const deletedPageResponse = await fetch(`http://127.0.0.1:${port}/admin-api/pages/${encodeURIComponent(pageId)}`, {
      headers: { cookie: authCookie }
    });

    assert.equal(deletedPageResponse.status, 404);
  } finally {
    await server.stop();
  }
});
