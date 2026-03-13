import type { CanonicalThemeTemplateName, ThemeTemplateContext } from '../../core/theme/theme-contract.ts';

const escapeHtml = (value: unknown): string => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatDate = (value: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
};

const toExcerpt = (content: string): string => {
  const normalized = `${content ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'No summary available yet.';
  }

  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
};

const baseStyles = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    line-height: 1.65;
    color: #1f2937;
    background: #f8fafc;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  a { color: #0f4c81; text-decoration: none; }
  a:hover, a:focus-visible { text-decoration: underline; }
  .site-shell {
    width: min(100% - 2rem, 940px);
    margin: 0 auto;
  }
  .site-header {
    padding: 1.5rem 0 1rem;
    border-bottom: 1px solid #dbe4ee;
  }
  .site-title {
    margin: 0;
    font-size: clamp(1.5rem, 4vw, 1.95rem);
    line-height: 1.2;
  }
  .site-tagline { margin: 0.5rem 0 0; color: #4b5563; }
  .site-nav {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .site-nav a {
    border: 1px solid #dbe4ee;
    border-radius: 10px;
    background: #ffffff;
    padding: 0.42rem 0.7rem;
  }
  .site-nav a[aria-current="page"] { font-weight: 700; text-decoration: underline; }
  main.site-shell {
    width: min(100% - 2rem, 760px);
    padding-top: 1.35rem;
    padding-bottom: 2rem;
    min-height: 60vh;
  }
  .panel {
    background: #ffffff;
    border: 1px solid #dbe4ee;
    border-radius: 12px;
    padding: clamp(1rem, 3vw, 1.3rem);
    margin-bottom: 1rem;
  }
  .post-stack {
    display: grid;
    gap: 0.85rem;
  }
  h1, h2, h3 {
    line-height: 1.25;
    margin-top: 0;
    color: #0f172a;
    overflow-wrap: anywhere;
  }
  .meta {
    color: #64748b;
    font-size: 0.9rem;
    margin-top: -0.2rem;
    margin-bottom: 0.85rem;
  }
  .content { white-space: pre-wrap; }
  code, pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow-wrap: anywhere;
  }
  pre { overflow-x: auto; }
  .site-footer { border-top: 1px solid #dbe4ee; padding: 1rem 0 2rem; color: #64748b; }

  @media (max-width: 768px) {
    .site-shell { width: min(100% - 1.25rem, 940px); }
    .site-header { padding-top: 1.1rem; }
    main.site-shell { width: min(100% - 1.25rem, 760px); padding-top: 1rem; }
  }
`;

const renderNavigation = (routePath: string, pages: ThemeTemplateContext['pages'] = []): string => {
  const pageLinks = pages
    .filter((page) => `${page.slug ?? ''}`.trim() !== '')
    .sort((a, b) => `${a.title}`.localeCompare(`${b.title}`))
    .map((page) => {
      const href = `/${encodeURIComponent(page.slug)}`;
      const isCurrent = routePath === href;
      return `<a href="${href}"${isCurrent ? ' aria-current="page"' : ''}>${escapeHtml(page.title || 'Page')}</a>`;
    })
    .join('');

  return `<nav class="site-nav" aria-label="Primary navigation">
    <a href="/"${routePath === '/' ? ' aria-current="page"' : ''}>Home</a>
    <a href="/blog"${routePath.startsWith('/blog') ? ' aria-current="page"' : ''}>Blog</a>
    ${pageLinks}
  </nav>`;
};

const renderLayout = (context: ThemeTemplateContext, body: string): string => {
  const resolvedTagline = `${context.siteTagline ?? ''}`.trim() || 'A simple website powered by Nimb CMS.';
  const resolvedFooterText = `${context.footerText ?? ''}`.trim() || `© ${new Date().getFullYear()} ${context.siteName}.`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(context.siteName)}</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <header>
      <div class="site-shell site-header">
        <h1 class="site-title">${escapeHtml(context.siteName)}</h1>
        <p class="site-tagline">${escapeHtml(resolvedTagline)}</p>
        ${renderNavigation(context.routePath, context.pages)}
      </div>
    </header>
    <main class="site-shell">${body}</main>
    <footer>
      <div class="site-shell site-footer">
        <small>${escapeHtml(resolvedFooterText)}</small>
      </div>
    </footer>
  </body>
</html>`;
};

const renderHomepage = (context: ThemeTemplateContext): string => {
  const homepageIntro = `${context.homepageIntro ?? ''}`.trim() || 'This homepage is ready for a company profile website. Create and publish pages like About, Services, and Contact from admin.';

  const latestPostMarkup = context.posts.length > 0
    ? `<section class="panel"><h2>Latest from the blog</h2><div class="post-stack">${context.posts.slice(0, 3)
      .map((post) => `<article><h3><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3><p class="meta">Updated ${escapeHtml(formatDate(post.updatedAt) || 'recently')}</p><p>${escapeHtml(toExcerpt(post.content))}</p></article>`)
      .join('')}</div></section>`
    : '<section class="panel"><h2>Latest from the blog</h2><p>No blog posts published yet. Write your first post in admin to start sharing updates.</p></section>';

  return renderLayout(context, `<section class="panel"><h2>Welcome to ${escapeHtml(context.siteName)}</h2><p>${escapeHtml(homepageIntro)}</p></section>${latestPostMarkup}`);
};

const renderPostList = (context: ThemeTemplateContext): string => {
  if (context.posts.length < 1) {
    return renderLayout(context, '<section class="panel"><h2>Blog</h2><p>No posts published yet. Check back soon.</p></section>');
  }

  const listMarkup = context.posts
    .map((post) => `<article class="panel"><h3><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3><p class="meta">Updated ${escapeHtml(formatDate(post.updatedAt) || 'recently')}</p><p>${escapeHtml(toExcerpt(post.content))}</p></article>`)
    .join('');

  return renderLayout(context, `<section><h2>Blog</h2><p class="meta">Latest published posts.</p>${listMarkup}</section>`);
};

const renderPostPage = (context: ThemeTemplateContext): string => {
  if (!context.post) {
    return renderLayout(context, '<section class="panel"><h2>Post not found</h2><p>We could not find that post. Try the <a href="/blog">blog list</a>.</p></section>');
  }

  return renderLayout(context, `<article class="panel"><h1>${escapeHtml(context.post.title)}</h1><p class="meta">Updated ${escapeHtml(formatDate(context.post.updatedAt) || 'recently')}</p><div class="content">${escapeHtml(context.post.content)}</div></article>`);
};

const renderPage = (context: ThemeTemplateContext): string => {
  if (!context.page) {
    return renderLayout(context, '<section class="panel"><h2>Page not found</h2><p>We could not find that page. Return to the <a href="/">homepage</a>.</p></section>');
  }

  return renderLayout(context, `<article class="panel content"><h1>${escapeHtml(context.page.title)}</h1><div>${escapeHtml(context.page.content)}</div></article>`);
};

const renderNotFound = (context: ThemeTemplateContext): string => renderLayout(
  context,
  `<section class="panel"><h2>Page not found</h2><p>We couldn't find <code>${escapeHtml(context.routePath)}</code>.</p><p><a href="/">Go to homepage</a> or visit the <a href="/blog">blog</a>.</p></section>`
);

export const defaultThemeTemplates: Record<CanonicalThemeTemplateName, (context: ThemeTemplateContext) => string> = Object.freeze({
  homepage: renderHomepage,
  'post-list': renderPostList,
  'post-page': renderPostPage,
  page: renderPage,
  'not-found': renderNotFound
});
