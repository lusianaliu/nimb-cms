import type { CanonicalThemeTemplateName, ThemeTemplateContext } from '../../core/theme/theme-contract.ts';

const escapeHtml = (value: unknown): string => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderLayout = (context: ThemeTemplateContext, body: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(context.siteName)}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #fff8f1; color: #1f2937; }
      header, footer { background: #7c2d12; color: #fff; padding: 1rem; }
      main { max-width: 860px; margin: 0 auto; padding: 1rem; }
      .panel { background: #ffffff; border: 1px solid #fed7aa; border-radius: 10px; padding: 1rem; margin-bottom: 1rem; }
      a { color: #9a3412; }
    </style>
  </head>
  <body>
    <header><strong>${escapeHtml(context.siteName)}</strong> · Sunrise theme</header>
    <main>${body}</main>
    <footer>${escapeHtml(context.footerText || `© ${new Date().getFullYear()} ${context.siteName}`)}</footer>
  </body>
</html>`;

const renderHomepage = (context: ThemeTemplateContext) => renderLayout(
  context,
  `<section class="panel"><h1>Welcome</h1><p>${escapeHtml(context.homepageIntro)}</p></section>`
);

const renderPage = (context: ThemeTemplateContext) => renderLayout(
  context,
  context.page
    ? `<article class="panel"><h1>${escapeHtml(context.page.title)}</h1><div>${escapeHtml(context.page.content)}</div></article>`
    : '<section class="panel"><h1>Page not found</h1></section>'
);

const renderPostList = (context: ThemeTemplateContext) => renderLayout(
  context,
  `<section class="panel"><h1>Blog</h1>${context.posts.map((post) => `<p><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></p>`).join('') || '<p>No posts yet.</p>'}</section>`
);

const renderPostPage = (context: ThemeTemplateContext) => renderLayout(
  context,
  context.post
    ? `<article class="panel"><h1>${escapeHtml(context.post.title)}</h1><div>${escapeHtml(context.post.content)}</div></article>`
    : '<section class="panel"><h1>Post not found</h1></section>'
);

const renderNotFound = (context: ThemeTemplateContext) => renderLayout(
  context,
  `<section class="panel"><h1>Not found</h1><p>Missing route: ${escapeHtml(context.routePath)}</p></section>`
);

export const sunriseThemeTemplates: Record<CanonicalThemeTemplateName, (context: ThemeTemplateContext) => string> = Object.freeze({
  homepage: renderHomepage,
  page: renderPage,
  'post-list': renderPostList,
  'post-page': renderPostPage,
  'not-found': renderNotFound
});
