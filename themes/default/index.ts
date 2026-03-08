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
};

type ThemeContext = {
  siteName: string;
  routePath: string;
  posts?: ThemeEntry[];
  post?: ThemeEntry;
  page?: ThemeEntry;
};

const renderLayout = ({ siteName, routePath }: ThemeContext, body: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(siteName)}</title>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(siteName)}</h1>
      <nav>
        <a href="/"${routePath === '/' ? ' aria-current="page"' : ''}>Home</a>
        <a href="/blog"${routePath.startsWith('/blog') ? ' aria-current="page"' : ''}>Blog</a>
      </nav>
    </header>
    <main>${body}</main>
  </body>
</html>`;

const renderHomepage = (context: ThemeContext): string => {
  const posts = Array.isArray(context.posts) ? context.posts : [];
  const listMarkup = posts.length > 0
    ? `<ul>${posts
      .map((post) => `<li><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></li>`)
      .join('')}</ul>`
    : '<p>No posts yet.</p>';

  return renderLayout(context, `<section><h2>Homepage</h2><p>Welcome to ${escapeHtml(context.siteName)}</p>${listMarkup}</section>`);
};

const renderPostList = (context: ThemeContext): string => {
  const posts = Array.isArray(context.posts) ? context.posts : [];
  const listMarkup = posts.length > 0
    ? posts.map((post) => `<article><h2><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2></article>`).join('')
    : '<p>No posts yet.</p>';

  return renderLayout(context, `<section><h2>Blog</h2>${listMarkup}</section>`);
};

const renderPostPage = (context: ThemeContext): string => {
  const post = context.post;

  if (!post) {
    return renderLayout(context, '<section><h2>Post not found</h2></section>');
  }

  return renderLayout(context, `<article><h2>${escapeHtml(post.title)}</h2><div>${escapeHtml(post.content)}</div></article>`);
};

const renderPage = (context: ThemeContext): string => {
  const page = context.page;

  if (!page) {
    return renderLayout(context, '<section><h2>Page not found</h2></section>');
  }

  return renderLayout(context, `<article><h2>${escapeHtml(page.title)}</h2><div>${escapeHtml(page.content)}</div></article>`);
};

export const defaultThemeTemplates = Object.freeze({
  homepage: renderHomepage,
  'post-list': renderPostList,
  'post-page': renderPostPage,
  page: renderPage
});
