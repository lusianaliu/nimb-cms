import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAdminDashboardPage } from '../core/admin/admin-dashboard-page.ts';
import { renderAdminPagesListPage } from '../core/admin/admin-pages-page.ts';
import { renderLoginView } from '../core/admin/views/login.ts';

const createRuntime = () => ({
  version: '146.0.0',
  admin: {
    title: 'Acme Admin',
    navRegistry: {
      list: () => [
        { id: 'dashboard', label: 'Dashboard', path: '/admin' },
        { id: 'pages', label: 'Pages', path: '/admin/pages' },
        { id: 'posts', label: 'Posts', path: '/admin/posts' },
        { id: 'media', label: 'Media', path: '/admin/media' },
        { id: 'settings', label: 'Settings', path: '/admin/settings' }
      ]
    }
  },
  settings: {
    get: (key: string) => (key === 'site.name' ? 'My Nimb Site' : null)
  },
  system: {
    config: {
      version: '146.0.0',
      installedAt: '2026-03-10T00:00:00.000Z'
    }
  }
});

test('phase 146: dashboard shell renders welcome guidance and core navigation', () => {
  const html = renderAdminDashboardPage(createRuntime(), { welcome: true });

  assert.equal(html.includes('Acme Admin'), true);
  assert.equal(html.includes('Welcome to Nimb CMS.'), true);
  assert.equal(html.includes('Create a new page'), true);
  assert.equal(html.includes('Write a new post'), true);
  assert.equal(html.includes('Update site settings'), true);
  assert.equal(html.includes('href="/admin" aria-current="page" class="is-active">Dashboard</a>'), true);
  assert.equal(html.includes('href="/admin/pages"'), true);
  assert.equal(html.includes('href="/admin/posts"'), true);
  assert.equal(html.includes('href="/admin/media"'), true);
  assert.equal(html.includes('href="/admin/settings"'), true);
  assert.equal(html.includes('action="/admin/logout"'), true);
});

test('phase 146: pages list renders inside shared shell surface', () => {
  const html = renderAdminPagesListPage({ pages: [], runtime: createRuntime() });

  assert.equal(html.includes('<title>Pages · Nimb CMS Admin</title>'), true);
  assert.equal(html.includes('No pages yet. Create a new page to build your website navigation.'), true);
  assert.equal(html.includes('class="admin-surface"'), true);
});

test('phase 146: login view supports install welcome continuity', () => {
  const html = renderLoginView({
    title: 'Login · Nimb Admin',
    notice: 'Installation complete. Sign in to open your dashboard.',
    next: '/admin?welcome=1'
  });

  assert.equal(html.includes('Installation complete. Sign in to open your dashboard.'), true);
  assert.equal(html.includes('name="next" value="/admin?welcome=1"'), true);
  assert.equal(html.includes('Sign in'), true);
});
