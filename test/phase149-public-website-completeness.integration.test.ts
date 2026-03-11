import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase149-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

test('phase 149: public website renders coherent homepage, pages, blog, and not-found states', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port, runtime } = await createInstalledServer({ cwd });

  try {
    runtime.db.create('page', {
      title: 'About',
      slug: 'about',
      content: 'About content for visitors.',
      status: 'published'
    });

    runtime.db.create('page', {
      title: 'Services',
      slug: 'services',
      content: 'Services content for visitors.',
      status: 'published'
    });

    runtime.db.create('page', {
      title: 'Draft Contact',
      slug: 'contact',
      content: 'Should not be public.',
      status: 'draft'
    });

    runtime.db.create('post', {
      title: 'Published Update',
      slug: 'published-update',
      content: 'Public blog content.',
      status: 'published',
      updatedAt: new Date('2026-03-03T10:00:00.000Z')
    });

    runtime.db.create('post', {
      title: 'Draft Update',
      slug: 'draft-update',
      content: 'Draft blog content.',
      status: 'draft'
    });

    await runtime.settings.updateSettings({
      siteName: 'Phase 149 Website',
      tagline: 'Company profile and blog',
      homepageIntro: 'Welcome to our company website.',
      footerText: '© 2026 Phase 149 Company'
    });

    const homeResponse = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(homeResponse.status, 200);
    const homeHtml = await homeResponse.text();
    assert.equal(homeHtml.includes('Welcome'), true);
    assert.equal(homeHtml.includes('Phase 149 Website'), true);
    assert.equal(homeHtml.includes('Company profile and blog'), true);
    assert.equal(homeHtml.includes('Welcome to our company website.'), true);
    assert.equal(homeHtml.includes('© 2026 Phase 149 Company'), true);
    assert.equal(homeHtml.includes('Published Update'), true);
    assert.equal(homeHtml.includes('Draft Update'), false);
    assert.equal(homeHtml.includes('href="/about"'), true);
    assert.equal(homeHtml.includes('href="/services"'), true);
    assert.equal(homeHtml.includes('href="/contact"'), false);

    assert.equal(homeHtml.indexOf('href="/about"') < homeHtml.indexOf('href="/services"'), true);

    const blogListResponse = await fetch(`http://127.0.0.1:${port}/blog`);
    assert.equal(blogListResponse.status, 200);
    const blogListHtml = await blogListResponse.text();
    assert.equal(blogListHtml.includes('Published Update'), true);
    assert.equal(blogListHtml.includes('Draft Update'), false);
    assert.equal(blogListHtml.includes('/blog/published-update'), true);

    const blogPostResponse = await fetch(`http://127.0.0.1:${port}/blog/published-update`);
    assert.equal(blogPostResponse.status, 200);
    assert.equal((await blogPostResponse.text()).includes('Public blog content.'), true);

    const draftPostResponse = await fetch(`http://127.0.0.1:${port}/blog/draft-update`);
    assert.equal(draftPostResponse.status, 404);
    assert.equal((await draftPostResponse.text()).includes('Page not found'), true);

    const pageResponse = await fetch(`http://127.0.0.1:${port}/about`);
    assert.equal(pageResponse.status, 200);
    assert.equal((await pageResponse.text()).includes('About content for visitors.'), true);

    const missingPageResponse = await fetch(`http://127.0.0.1:${port}/missing-page`);
    assert.equal(missingPageResponse.status, 404);
    const missingPageHtml = await missingPageResponse.text();
    assert.equal(missingPageHtml.includes('Page not found'), true);
    assert.equal(missingPageHtml.includes('/missing-page'), true);
  } finally {
    await server.stop();
  }
});
