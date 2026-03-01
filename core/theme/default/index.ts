import { renderLayout } from './layout.ts';
import { renderHomeTemplate } from './templates/home.ts';
import { renderBlogListTemplate } from './templates/blog-list.ts';
import { renderBlogSingleTemplate } from './templates/blog-single.ts';
import { renderPageTemplate } from './templates/page.ts';
import { renderNotFoundTemplate } from './templates/not-found.ts';

const TEMPLATE_RENDERERS = Object.freeze({
  home: renderHomeTemplate,
  'blog-list': renderBlogListTemplate,
  'blog-single': renderBlogSingleTemplate,
  page: renderPageTemplate,
  'not-found': renderNotFoundTemplate
});

export const createDefaultPublicTheme = () => Object.freeze({
  id: 'default',
  render(templateName: string, context) {
    const templateRenderer = TEMPLATE_RENDERERS[templateName] ?? TEMPLATE_RENDERERS['not-found'];
    const body = templateRenderer(context);
    return renderLayout(context, body);
  }
});
