export const renderBlogListTemplate = (context) => {
  const escape = context?.htmlEscape ?? ((value) => `${value ?? ''}`);
  const posts = Array.isArray(context?.content?.posts) ? context.content.posts : [];

  if (posts.length === 0) {
    return '<section><h2>Blog</h2><p>No posts yet.</p></section>';
  }

  const items = posts
    .map((post) => `<article><h3><a href="/blog/${encodeURIComponent(`${post.slug ?? ''}`)}">${escape(post.title ?? 'Untitled')}</a></h3></article>`)
    .join('');

  return `<section><h2>Blog</h2>${items}</section>`;
};
