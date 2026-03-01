export const renderBlogSingleTemplate = (context) => {
  const escape = context?.htmlEscape ?? ((value) => `${value ?? ''}`);
  const post = context?.content?.post ?? {};

  return `<article><h2>${escape(post.title ?? 'Untitled')}</h2><div>${escape(post.content ?? '')}</div></article>`;
};
