import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase98-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '98.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
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

const createServer = async (cwd: string) => createInstalledServer({
  cwd,
  clock: () => '2026-01-01T00:00:10.000Z'
});

test.skip('phase 98: default site routes render home, blog, page, and 404', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '98.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const started = await createServer(cwd);

    started.runtime.contentStore.create('post', {
      title: 'Phase 98 Launch Post',
      slug: 'phase-98-launch',
      body: 'Core rendering is now active.',
      published: true
    });

    started.runtime.contentStore.create('page', {
      title: 'About',
      slug: 'about',
      body: 'About Nimb',
      published: true
    });

    try {
      const homeResponse = await fetch(`http://127.0.0.1:${started.port}/`);
      assert.equal(homeResponse.status, 200);
      const homeHtml = await homeResponse.text();
      assert.equal(homeHtml.includes('Phase 98 Launch Post'), true);

      const blogListResponse = await fetch(`http://127.0.0.1:${started.port}/blog`);
      assert.equal(blogListResponse.status, 200);
      const blogListHtml = await blogListResponse.text();
      assert.equal(blogListHtml.includes('Phase 98 Launch Post'), true);

      const blogSingleResponse = await fetch(`http://127.0.0.1:${started.port}/blog/phase-98-launch`);
      assert.equal(blogSingleResponse.status, 200);
      const blogSingleHtml = await blogSingleResponse.text();
      assert.equal(blogSingleHtml.includes('Core rendering is now active.'), true);

      const pageResponse = await fetch(`http://127.0.0.1:${started.port}/about`);
      assert.equal(pageResponse.status, 200);
      const pageHtml = await pageResponse.text();
      assert.equal(pageHtml.includes('About Nimb'), true);

      const notFoundResponse = await fetch(`http://127.0.0.1:${started.port}/missing-page`);
      assert.equal(notFoundResponse.status, 404);
      const notFoundHtml = await notFoundResponse.text();
      assert.equal(notFoundHtml.includes('Page not found: /missing-page'), true);
    } finally {
      await started.server.stop();
    }
  });
});
