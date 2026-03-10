const escapeHtml = (value: unknown): string => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

type ThemeEntry = {
  title: string;
  slug: string;
  content: string;
  updatedAt: string;
  excerpt?: string;
};

type ThemeContext = {
  siteName: string;
  routePath: string;
  posts?: ThemeEntry[];
  post?: ThemeEntry;
  page?: ThemeEntry;
  pages?: ThemeEntry[];
};

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
  body { margin: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f8fafc; }
  a { color: #0f4c81; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .site-shell { max-width: 940px; margin: 0 auto; padding: 0 1rem; }
  .site-header { padding: 1.75rem 0 1.25rem; border-bottom: 1px solid #dbe4ee; }
  .site-title { margin: 0; font-size: 1.75rem; }
  .site-tagline { margin: 0.5rem 0 0; color: #4b5563; }
  .site-nav { margin-top: 1rem; display: flex; gap: 0.85rem; flex-wrap: wrap; }
  .site-nav a[aria-current="page"] { font-weight: 700; text-decoration: underline; }
  main.site-shell { padding-top: 2rem; padding-bottom: 2rem; min-height: 60vh; }
  .panel { background: #ffffff; border: 1px solid #dbe4ee; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
  h1, h2, h3 { line-height: 1.25; margin-top: 0; color: #0f172a; }
  .meta { color: #64748b; font-size: 0.9rem; margin-top: -0.25rem; margin-bottom: 1rem; }
  .content { white-space: pre-wrap; }
  .site-footer { border-top: 1px solid #dbe4ee; padding: 1rem 0 2rem; color: #64748b; }
`;

const renderNavigation = (routePath: string, pages: ThemeEntry[] = []): string => {
  const pageLinks = pages
    .filter((page) => `${page.slug ?? ''}`.trim() !== '')
    .map((page) => {
      const href = `/${encodeURIComponent(page.slug)}`;
      const isCurrent = routePath === href;
      return `<a href="${href}"${isCurrent ? ' aria-current="page"' : ''}>${escapeHtml(page.title || 'Page')}</a>`;
    })
    .join('');

  return `<nav class="site-nav">
    <a href="/"${routePath === '/' ? ' aria-current="page"' : ''}>Home</a>
    <a href="/blog"${routePath.startsWith('/blog') ? ' aria-current="page"' : ''}>Blog</a>
    ${pageLinks}
  </nav>`;
};

const renderLayout = ({ siteName, routePath, pages }: ThemeContext, body: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(siteName)}</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <header>
      <div class="site-shell site-header">
        <h1 class="site-title">${escapeHtml(siteName)}</h1>
        <p class="site-tagline">A simple website powered by Nimb CMS.</p>
        ${renderNavigation(routePath, pages)}
      </div>
    </header>
    <main class="site-shell">${body}</main>
    <footer>
      <div class="site-shell site-footer">
        <small>© ${new Date().getFullYear()} ${escapeHtml(siteName)}.</small>
      </div>
    </footer>
  </body>
</html>`;

const renderHomepage = (context: ThemeContext): string => {
  const posts = Array.isArray(context.posts) ? context.posts : [];
  const latestPostMarkup = posts.length > 0
    ? `<section class="panel"><h2>Latest from the blog</h2>${posts.slice(0, 3)
      .map((post) => `<article><h3><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(toExcerpt(post.content))}</p></article>`)
      .join('')}</section>`
    : '<section class="panel"><h2>Latest from the blog</h2><p>No blog posts published yet. Add your first post in admin to start sharing updates.</p></section>';

  return renderLayout(context, `<section class="panel"><h2>Welcome</h2><p>This homepage is ready for a company profile website. Create and publish pages like About, Services, and Contact from admin.</p></section>${latestPostMarkup}`);
};

const renderPostList = (context: ThemeContext): string => {
  const posts = Array.isArray(context.posts) ? context.posts : [];

  if (posts.length < 1) {
    return renderLayout(context, '<section class="panel"><h2>Blog</h2><p>No posts have been published yet.</p></section>');
  }

  const listMarkup = posts
    .map((post) => `<article class="panel"><h3><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3><p class="meta">Updated ${escapeHtml(formatDate(post.updatedAt) || 'recently')}</p><p>${escapeHtml(toExcerpt(post.content))}</p></article>`)
    .join('');

  return renderLayout(context, `<section><h2>Blog</h2><p class="meta">Latest published posts.</p>${listMarkup}</section>`);
};

const renderPostPage = (context: ThemeContext): string => {
  const post = context.post;

  if (!post) {
    return renderLayout(context, '<section class="panel"><h2>Post not found</h2><p>The requested post could not be found.</p></section>');
  }

  return renderLayout(context, `<article class="panel"><h2>${escapeHtml(post.title)}</h2><p class="meta">Updated ${escapeHtml(formatDate(post.updatedAt) || 'recently')}</p><div class="content">${escapeHtml(post.content)}</div></article>`);
};

const renderPage = (context: ThemeContext): string => {
  const page = context.page;

  if (!page) {
    return renderLayout(context, '<section class="panel"><h2>Page not found</h2><p>The requested page could not be found.</p></section>');
  }

  return renderLayout(context, `<article class="panel"><h2>${escapeHtml(page.title)}</h2><div class="content">${escapeHtml(page.content)}</div></article>`);
};

const renderNotFound = (context: ThemeContext): string => renderLayout(
  context,
  `<section class="panel"><h2>404 — Page not found</h2><p>We couldn't find <code>${escapeHtml(context.routePath)}</code>.</p><p><a href="/">Go to homepage</a> or visit the <a href="/blog">blog</a>.</p></section>`
);

export const defaultThemeTemplates = Object.freeze({
  homepage: renderHomepage,
  'post-list': renderPostList,
  'post-page': renderPostPage,
  page: renderPage,
  'not-found': renderNotFound
});
