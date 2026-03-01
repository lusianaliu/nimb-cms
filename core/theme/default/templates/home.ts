export const renderHomeTemplate = (context) => {
  const escape = context?.htmlEscape ?? ((value) => `${value ?? ''}`);
  const posts = Array.isArray(context?.content?.posts) ? context.content.posts : [];

  if (posts.length === 0) {
    return `<section><h2>Welcome</h2><p>Welcome to My Nimb Site</p></section>`;
  }

  const items = posts
    .map((post) => `<li><a href="/blog/${encodeURIComponent(`${post.slug ?? ''}`)}">${escape(post.title ?? 'Untitled')}</a></li>`)
    .join('');

  return `<section><h2>Latest Posts</h2><ul>${items}</ul></section>`;
};
