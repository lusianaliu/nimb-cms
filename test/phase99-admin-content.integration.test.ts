import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase99-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '99.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const withInstallState = async (run: () => Promise<void> | void) => {
  const previousContent = fs.existsSync(INSTALL_STATE_PATH)
    ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8')
    : null;

  try {
    await run();
  } finally {
    if (previousContent === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousContent, 'utf8');
    }
  }
};

const createServer = async (cwd: string) => {
  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0,
    rootDirectory: cwd
  });

  const { port } = await server.start();
  return { server, port };
};

const adminHeaders = {
  'content-type': 'application/x-www-form-urlencoded',
  'x-nimb-capabilities': 'content.write'
};

test('phase 99: admin content routes create, update, and delete blog posts visible on /blog', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '99.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const { server, port } = await createServer(cwd);

    try {
      const createResponse = await fetch(`http://127.0.0.1:${port}/admin/content/post`, {
        method: 'POST',
        headers: adminHeaders,
        body: new URLSearchParams({ title: 'Phase 99 Admin Post', body: 'Created from admin route', published: 'true' }).toString(),
        redirect: 'manual'
      });
      assert.equal(createResponse.status, 302);

      const blogAfterCreate = await fetch(`http://127.0.0.1:${port}/blog`);
      const blogAfterCreateHtml = await blogAfterCreate.text();
      assert.equal(blogAfterCreateHtml.includes('Phase 99 Admin Post'), true);

      const listResponse = await fetch(`http://127.0.0.1:${port}/admin/content/post`, {
        headers: { 'x-nimb-capabilities': 'content.write' }
      });
      const listHtml = await listResponse.text();
      const idMatch = listHtml.match(/\/admin\/content\/post\/([^/]+)\/edit/);
      assert.ok(idMatch);
      const id = decodeURIComponent(idMatch?.[1] ?? '');

      const updateResponse = await fetch(`http://127.0.0.1:${port}/admin/content/post/${encodeURIComponent(id)}/update`, {
        method: 'POST',
        headers: adminHeaders,
        body: new URLSearchParams({ title: 'Phase 99 Admin Post Updated', slug: 'phase-99-admin-post', body: 'Updated from admin route', published: 'true' }).toString(),
        redirect: 'manual'
      });
      assert.equal(updateResponse.status, 302);

      const blogAfterUpdate = await fetch(`http://127.0.0.1:${port}/blog`);
      const blogAfterUpdateHtml = await blogAfterUpdate.text();
      assert.equal(blogAfterUpdateHtml.includes('Phase 99 Admin Post Updated'), true);

      const deleteResponse = await fetch(`http://127.0.0.1:${port}/admin/content/post/${encodeURIComponent(id)}/delete`, {
        method: 'POST',
        headers: { 'x-nimb-capabilities': 'content.write' },
        redirect: 'manual'
      });
      assert.equal(deleteResponse.status, 302);

      const blogAfterDelete = await fetch(`http://127.0.0.1:${port}/blog`);
      const blogAfterDeleteHtml = await blogAfterDelete.text();
      assert.equal(blogAfterDeleteHtml.includes('Phase 99 Admin Post Updated'), false);

      const forbidden = await fetch(`http://127.0.0.1:${port}/admin/content/post`);
      assert.equal(forbidden.status, 403);
    } finally {
      await server.stop();
    }
  });
});
