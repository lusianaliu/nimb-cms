import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeRenderer, listRegisteredPublicThemes, resolveCanonicalTemplateName } from '../core/theme/theme-renderer.ts';

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
        footerText: 'Footer',
        theme: 'default'
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

test('createThemeRenderer loads active public theme from settings.theme', () => {
  const runtime = {
    settings: {
      getSettings: () => ({
        siteName: 'Sunrise Site',
        theme: 'sunrise'
      }),
      get: () => undefined
    }
  };

  const renderer = createThemeRenderer(runtime);
  const html = renderer.renderTemplate('homepage');

  assert.equal(html.includes('Sunrise theme'), true);
});

test('createThemeRenderer falls back to default theme when configured theme is missing', () => {
  const warnings: string[] = [];
  const runtime = {
    settings: {
      getSettings: () => ({
        siteName: 'Fallback Site',
        theme: 'missing-theme'
      }),
      get: () => undefined
    },
    logger: {
      warn: (message: string) => warnings.push(message)
    }
  };

  const renderer = createThemeRenderer(runtime);
  const html = renderer.renderTemplate('homepage');

  assert.equal(html.includes('Welcome'), true);
  assert.equal(warnings.some((warning) => warning.includes('not registered')), true);
});

test('createThemeRenderer falls back to default template when selected theme is incomplete', () => {
  const warnings: string[] = [];
  const runtime = {
    settings: {
      getSettings: () => ({
        siteName: 'Fallback Template Site',
        theme: 'partial'
      }),
      get: () => undefined
    },
    logger: {
      warn: (message: string) => warnings.push(message)
    }
  };

  const partialTheme = {
    homepage: () => '<html><body>Partial Home</body></html>'
  };

  const renderer = createThemeRenderer(runtime, {
    publicThemes: {
      default: {
        homepage: () => '<html><body>Default Home</body></html>',
        page: () => '<html><body>Default Page</body></html>',
        'post-list': () => '<html><body>Default Post List</body></html>',
        'post-page': () => '<html><body>Default Post Page</body></html>',
        'not-found': () => '<html><body>Default Not Found</body></html>'
      },
      partial: partialTheme
    }
  });

  const postListHtml = renderer.renderTemplate('post-list');

  assert.equal(postListHtml.includes('Blog'), true);
  assert.equal(warnings.some((warning) => warning.includes('missing template')), true);
});

test('listRegisteredPublicThemes includes default and sunrise', () => {
  assert.deepEqual(listRegisteredPublicThemes().sort(), ['default', 'sunrise']);
});
