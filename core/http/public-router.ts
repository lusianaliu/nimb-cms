import { createRouter } from './router.ts';

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
  const contentValue = data.content ?? data.body ?? '';

  return Object.freeze({
    title: `${data.title ?? 'Untitled'}`,
    slug: `${data.slug ?? ''}`,
    content: typeof contentValue === 'string' ? contentValue : JSON.stringify(contentValue),
    updatedAt: entry?.updatedAt instanceof Date ? entry.updatedAt.toISOString() : `${entry?.updatedAt ?? ''}`
  });
};

const queryEntries = (runtime, type: string, options: Record<string, unknown> = {}) => {
  try {
    return runtime?.db?.query?.(type, options) ?? [];
  } catch {
    return [];
  }
};

const getPostBySlug = (runtime, slug: string) => queryEntries(runtime, 'post', { sort: 'updatedAt desc' })
  .find((entry) => `${entry?.data?.slug ?? ''}` === slug);

const getPageBySlug = (runtime, slug: string) => queryEntries(runtime, 'page', { sort: 'updatedAt desc' })
  .find((entry) => `${entry?.data?.slug ?? ''}` === slug);

export const createPublicRouter = (runtime) => createRouter([
  {
    method: 'GET',
    path: '/',
    handler: (context) => {
      const posts = queryEntries(runtime, 'post', {
        sort: 'updatedAt desc',
        limit: 10
      }).map(toRenderableEntry);

      return toHtmlResponse(runtime?.themeRenderer?.renderTemplate?.('homepage', runtime, {
        routePath: context.path,
        posts
      }) ?? '');
    }
  },
  {
    method: 'GET',
    path: '/blog',
    handler: (context) => {
      const posts = queryEntries(runtime, 'post', {
        sort: 'updatedAt desc',
        limit: 50
      }).map(toRenderableEntry);

      return toHtmlResponse(runtime?.themeRenderer?.renderTemplate?.('post-list', runtime, {
        routePath: context.path,
        posts
      }) ?? '');
    }
  },
  {
    method: 'GET',
    path: '/blog/:slug',
    handler: (context) => {
      const post = getPostBySlug(runtime, `${context.params?.slug ?? ''}`);
      if (!post) {
        return toHtmlResponse('Not Found', 404);
      }

      return toHtmlResponse(runtime?.themeRenderer?.renderTemplate?.('post-page', runtime, {
        routePath: context.path,
        post: toRenderableEntry(post)
      }) ?? '');
    }
  },
  {
    method: 'GET',
    path: '/:pageSlug',
    handler: (context) => {
      const page = getPageBySlug(runtime, `${context.params?.pageSlug ?? ''}`);
      if (!page) {
        return toHtmlResponse('Not Found', 404);
      }

      return toHtmlResponse(runtime?.themeRenderer?.renderTemplate?.('page', runtime, {
        routePath: context.path,
        page: toRenderableEntry(page)
      }) ?? '');
    }
  }
]);
