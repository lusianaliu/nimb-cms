export const renderPageTemplate = (context) => {
  const escape = context?.htmlEscape ?? ((value) => `${value ?? ''}`);
  const page = context?.content?.page ?? {};

  return `<article><h2>${escape(page.title ?? 'Untitled')}</h2><div>${escape(page.content ?? '')}</div></article>`;
};
