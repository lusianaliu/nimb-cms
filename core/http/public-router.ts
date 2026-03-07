import { createRouter } from './router.ts';
import { createPublicRenderer, getLatestPosts, getPageBySlug, getPostBySlug } from '../render/public-renderer.ts';

const toHtmlResponse = (html: string, statusCode = 200) => ({
  statusCode,
  send(response) {
    const body = Buffer.from(html, 'utf8');
    response.writeHead(statusCode, {
      'content-length': body.byteLength,
      'content-type': 'text/html; charset=utf-8'
    });
    response.end(body);
  }
});

const toRenderableEntry = (entry) => {
  const data = entry?.data ?? {};
  return Object.freeze({
    title: `${data.title ?? 'Untitled'}`,
    slug: `${data.slug ?? ''}`,
    content: `${data.body ?? ''}`
  });
};

export const createPublicRouter = (runtime) => {
  const renderer = createPublicRenderer(runtime);

  return createRouter([
    {
      method: 'GET',
      path: '/',
      handler: (context) => {
        const posts = getLatestPosts(runtime, 5);
        const html = renderer.renderRoute({
          path: context.path,
          params: context.params,
          template: 'home',
          content: { posts }
        });

        return toHtmlResponse(html);
      }
    },
    {
      method: 'GET',
      path: '/blog',
      handler: (context) => {
        const exactPage = getPageBySlug(runtime, 'blog');
        if (exactPage) {
          const html = renderer.renderRoute({
            path: context.path,
            params: context.params,
            template: 'page',
            content: { page: toRenderableEntry(exactPage) }
          });
          return toHtmlResponse(html);
        }

        const html = renderer.renderRoute({
          path: context.path,
          params: context.params,
          template: 'blog-list',
          content: { posts: getLatestPosts(runtime, 50) }
        });
        return toHtmlResponse(html);
      }
    },
    {
      method: 'GET',
      path: '/blog/:slug',
      handler: (context) => {
        const post = getPostBySlug(runtime, context.params?.slug);
        if (!post) {
          const html = renderer.renderRoute({
            path: context.path,
            params: context.params,
            template: 'not-found',
            content: null
          });
          return toHtmlResponse(html, 404);
        }

        const html = renderer.renderRoute({
          path: context.path,
          params: context.params,
          template: 'blog-single',
          content: { post: toRenderableEntry(post) }
        });

        return toHtmlResponse(html);
      }
    },
    {
      method: 'GET',
      path: '/:pageSlug',
      handler: (context) => {
        const slug = `${context.params?.pageSlug ?? ''}`;
        const page = runtime.content.list('page').find((entry) => `${entry?.data?.slug ?? ''}` === slug);

        if (!page) {
          return toHtmlResponse('Not Found', 404);
        }

        const html = runtime?.themeRenderer?.renderThemePage?.('page', runtime, {
          title: `${page?.data?.title ?? ''}`,
          body: `${page?.data?.body ?? ''}`
        });

        return toHtmlResponse(html ?? '');
      }
    }
  ]);
};
