import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase100-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '100.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
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
  return { bootstrap, server, port };
};

test('phase 100: admin content routes render inside shell with active navigation state', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '100.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const { bootstrap, server, port } = await createServer(cwd);

    try {
      assert.equal(bootstrap.runtime.admin.title, 'Acme Admin');

      const pageListResponse = await fetch(`http://127.0.0.1:${port}/admin/content/page`, {
        headers: { 'x-nimb-capabilities': 'content.write' }
      });
      assert.equal(pageListResponse.status, 200);
      const pageListHtml = await pageListResponse.text();
      assert.equal(pageListHtml.includes('<aside class="admin-sidebar">'), true);
      assert.equal(pageListHtml.includes('<main class="admin-main">'), true);
      assert.equal(pageListHtml.includes('<h1>page entries</h1>'), true);
      assert.equal(pageListHtml.includes('<a href="/admin/content/page" aria-current="page" class="is-active">Content</a>'), true);
      assert.equal(pageListHtml.includes('<title>Content · Acme Admin</title>'), true);

      const postListResponse = await fetch(`http://127.0.0.1:${port}/admin/content/post`, {
        headers: { 'x-nimb-capabilities': 'content.write' }
      });
      assert.equal(postListResponse.status, 200);
      const postListHtml = await postListResponse.text();
      assert.equal(postListHtml.includes('<h1>post entries</h1>'), true);
      assert.equal(postListHtml.includes('<a href="/admin/content/post" aria-current="page" class="is-active">Posts</a>'), true);

      const adminFallbackResponse = await fetch(`http://127.0.0.1:${port}/admin/content/page/does-not-exist`, {
        headers: { 'x-nimb-capabilities': 'content.write' }
      });
      assert.equal(adminFallbackResponse.status, 200);
      assert.equal((await adminFallbackResponse.text()).includes('<script src="/admin/app.js"></script>'), true);
    } finally {
      await server.stop();
    }
  });
});
