import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase151-'));

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
  return (loginResponse.headers.get('set-cookie') ?? '').split(';')[0];
};

test('phase 151: login and dashboard language is consistent and first-use oriented', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const welcome = await fetch(`http://127.0.0.1:${port}/admin/login?welcome=1`);
    const welcomeHtml = await welcome.text();
    assert.equal(welcome.status, 200);
    assert.equal(welcomeHtml.includes('Installation complete. Sign in to open your dashboard.'), true);

    const installed = await fetch(`http://127.0.0.1:${port}/admin/login?install=complete`);
    const installedHtml = await installed.text();
    assert.equal(installedHtml.includes('This site is already installed. Sign in to continue.'), true);

    const loggedOut = await fetch(`http://127.0.0.1:${port}/admin/login?logged_out=1`);
    const loggedOutHtml = await loggedOut.text();
    assert.equal(loggedOutHtml.includes('You have signed out successfully.'), true);

    const invalidLogin = await fetch(`http://127.0.0.1:${port}/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'admin@nimb.local', password: 'wrong-password' }).toString()
    });
    const invalidLoginHtml = await invalidLogin.text();
    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLoginHtml.includes('We could not sign you in. Check your email and password and try again.'), true);

    const authCookie = await loginAsAdmin(port);
    const dashboard = await fetch(`http://127.0.0.1:${port}/admin?welcome=1`, {
      headers: { cookie: authCookie }
    });
    const dashboardHtml = await dashboard.text();
    assert.equal(dashboard.status, 200);
    assert.equal(dashboardHtml.includes('Welcome to Nimb CMS.'), true);
    assert.equal(dashboardHtml.includes('Create a new page'), true);
    assert.equal(dashboardHtml.includes('Write a new post'), true);
    assert.equal(dashboardHtml.includes('Update site settings'), true);
  } finally {
    await server.stop();
  }
});

test('phase 151: post/page notices and public empty states use consistent wording', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const authCookie = await loginAsAdmin(port);

    const pageCreateResponse = await fetch(`http://127.0.0.1:${port}/admin/pages/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'About',
        slug: 'about',
        body: 'About us',
        status: 'draft'
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(pageCreateResponse.headers.get('location'), '/admin/pages?notice=created');

    const pages = await fetch(`http://127.0.0.1:${port}/admin/pages?notice=created`, {
      headers: { cookie: authCookie }
    });
    const pagesHtml = await pages.text();
    assert.equal(pagesHtml.includes('Page saved'), true);

    const postCreateResponse = await fetch(`http://127.0.0.1:${port}/admin/posts/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: authCookie
      },
      body: new URLSearchParams({
        title: 'First update',
        slug: 'first-update',
        body: 'Update body',
        status: 'draft',
        publishedAt: ''
      }).toString(),
      redirect: 'manual'
    });
    assert.equal(postCreateResponse.headers.get('location'), '/admin/posts?notice=created');

    const posts = await fetch(`http://127.0.0.1:${port}/admin/posts?notice=created`, {
      headers: { cookie: authCookie }
    });
    const postsHtml = await posts.text();
    assert.equal(postsHtml.includes('Post saved'), true);

    const blog = await fetch(`http://127.0.0.1:${port}/blog`);
    const blogHtml = await blog.text();
    assert.equal(blogHtml.includes('No posts published yet. Check back soon.'), true);

    const missing = await fetch(`http://127.0.0.1:${port}/missing-route`);
    const missingHtml = await missing.text();
    assert.equal(missing.status, 404);
    assert.equal(missingHtml.includes('<h2>Page not found</h2>'), true);
  } finally {
    await server.stop();
  }
});
