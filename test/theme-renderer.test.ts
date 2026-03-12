import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeRenderer, resolveCanonicalTemplateName } from '../core/theme/theme-renderer.ts';

test('resolveCanonicalTemplateName keeps canonical names and maps legacy aliases', () => {
  assert.equal(resolveCanonicalTemplateName('homepage'), 'homepage');
  assert.equal(resolveCanonicalTemplateName('index'), 'homepage');
  assert.equal(resolveCanonicalTemplateName('home'), 'homepage');
  assert.equal(resolveCanonicalTemplateName('blog-list'), 'post-list');
  assert.equal(resolveCanonicalTemplateName('blog-single'), 'post-page');
});

test('resolveCanonicalTemplateName falls back to page for unknown template names', () => {
  assert.equal(resolveCanonicalTemplateName('unknown-template'), 'page');
});

test('createThemeRenderer injects stable baseline context shape for templates', () => {
  const runtime = {
    settings: {
      getSettings: () => ({
        siteName: 'Theme Contract Site',
        tagline: 'Tagline',
        homepageIntro: 'Intro',
        footerText: 'Footer'
      }),
      get: () => undefined
    }
  };

  const renderer = createThemeRenderer(runtime);
  const html = renderer.renderTemplate('post-page', runtime, {
    routePath: '/blog/hello-world',
    routeParams: { slug: 'hello-world' },
    pages: [{ title: 'About', slug: 'about', content: '', updatedAt: '' }],
    post: { title: 'Hello World', slug: 'hello-world', content: 'Body', updatedAt: '2026-03-01T10:00:00.000Z' }
  });

  assert.equal(html.includes('Theme Contract Site'), true);
  assert.equal(html.includes('Tagline'), true);
  assert.equal(html.includes('Footer'), true);
  assert.equal(html.includes('Hello World'), true);
  assert.equal(html.includes('href="/about"'), true);
});

