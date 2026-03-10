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

const isPublishedEntry = (entry) => {
  const status = `${entry?.data?.status ?? 'published'}`.trim().toLowerCase();
  return status !== 'draft';
};

const queryEntries = (runtime, type: string, options: Record<string, unknown> = {}) => {
  try {
    const dbEntries = typeof runtime?.db?.query === 'function'
      ? (runtime.db.query(type, options) ?? [])
      : [];

    if (dbEntries.length > 0) {
      return dbEntries;
    }

    const queriedEntries = typeof runtime?.contentQuery?.list === 'function'
      ? (runtime.contentQuery.list(type, options) ?? [])
      : [];

    if (queriedEntries.length > 0) {
      return queriedEntries;
    }

    if (typeof runtime?.content?.list === 'function') {
      return runtime.content.list(type) ?? [];
    }

    return [];
  } catch {
    return [];
  }
};

const getPostBySlug = (runtime, slug: string) => queryEntries(runtime, 'post', { sort: 'updatedAt desc' })
  .filter(isPublishedEntry)
  .find((entry) => `${entry?.data?.slug ?? ''}` === slug);

const getPageBySlug = (runtime, slug: string) => queryEntries(runtime, 'page', { sort: 'updatedAt desc' })
  .filter(isPublishedEntry)
  .find((entry) => `${entry?.data?.slug ?? ''}` === slug);

const getNavigationPages = (runtime) => queryEntries(runtime, 'page', { sort: 'updatedAt desc', limit: 10 })
  .filter(isPublishedEntry)
  .filter((entry) => `${entry?.data?.slug ?? ''}` && `${entry?.data?.slug ?? ''}` !== 'home')
  .slice(0, 5)
  .map(toRenderableEntry);

const renderNotFound = (runtime, routePath: string) => runtime?.themeRenderer?.renderTemplate?.('not-found', runtime, {
  routePath,
  pages: getNavigationPages(runtime)
}) ?? 'Not Found';

export const createPublicRouter = (runtime) => createRouter([
  {
    method: 'GET',
    path: '/',
    handler: (context) => {
      const posts = queryEntries(runtime, 'post', {
        sort: 'updatedAt desc',
        limit: 10
      })
        .filter(isPublishedEntry)
        .map(toRenderableEntry);

      return toHtmlResponse(runtime?.themeRenderer?.renderTemplate?.('homepage', runtime, {
        routePath: context.path,
        pages: getNavigationPages(runtime),
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
      })
        .filter(isPublishedEntry)
        .map(toRenderableEntry);

      return toHtmlResponse(runtime?.themeRenderer?.renderTemplate?.('post-list', runtime, {
        routePath: context.path,
        pages: getNavigationPages(runtime),
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
        return toHtmlResponse(renderNotFound(runtime, context.path), 404);
      }

      return toHtmlResponse(runtime?.themeRenderer?.renderTemplate?.('post-page', runtime, {
        routePath: context.path,
        pages: getNavigationPages(runtime),
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
        return toHtmlResponse(renderNotFound(runtime, context.path), 404);
      }

      return toHtmlResponse(runtime?.themeRenderer?.renderTemplate?.('page', runtime, {
        routePath: context.path,
        pages: getNavigationPages(runtime),
        page: toRenderableEntry(page)
      }) ?? '');
    }
  }
]);
