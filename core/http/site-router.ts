import { createRouter } from './router.ts';
import { notFoundResponse } from './response.ts';

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

const getSettings = (runtime) => {
  const entries = runtime?.contentStore?.list('settings') ?? [];
  return entries[0]?.data ?? {};
};

const resolveSiteName = (runtime) => {
  try {
    const siteName = runtime?.settings?.get?.('site.name');
    if (typeof siteName === 'string' && siteName.trim()) {
      return siteName;
    }
  } catch {
    // Fall through to compatibility settings read.
  }

  const settings = getSettings(runtime);
  return `${settings.siteName ?? 'My Nimb Site'}`;
};

const listEntries = (runtime, type) => {
  try {
    return runtime?.contentQuery?.list(type, { includeDrafts: false }) ?? [];
  } catch {
    return [];
  }
};

const findBySlug = (runtime, type, slug) => {
  const entries = listEntries(runtime, type);
  return entries.find((entry) => `${entry?.data?.slug ?? ''}` === `${slug}`);
};

export const createSiteRouter = (runtime) => createRouter([
  {
    method: 'GET',
    path: '/',
    handler: () => {
      const siteName = resolveSiteName(runtime);
      const posts = listEntries(runtime, 'post')
        .sort((left, right) => Number(new Date(right.updatedAt ?? 0)) - Number(new Date(left.updatedAt ?? 0)))
        .slice(0, 10)
        .map(toRenderableEntry);

      if (posts.length === 0) {
        return toHtmlResponse(runtime.theme.renderHome({
          siteName,
          title: 'Welcome to Nimb',
          content: 'Your site is ready. Start creating content.',
          posts
        }));
      }

      return toHtmlResponse(runtime.theme.renderHome({
        siteName,
        title: 'Latest Posts',
        posts
      }));
    }
  },
  {
    method: 'GET',
    path: '/page/:slug',
    handler: (context) => {
      const entry = findBySlug(runtime, 'page', context.params?.slug);
      if (!entry) {
        return notFoundResponse({ path: context.path, timestamp: context.timestamp });
      }

      const renderable = toRenderableEntry(entry);
      return toHtmlResponse(runtime.theme.renderPage({
        siteName: resolveSiteName(runtime),
        title: renderable.title,
        content: renderable.content
      }));
    }
  },
  {
    method: 'GET',
    path: '/post/:slug',
    handler: (context) => {
      const entry = findBySlug(runtime, 'post', context.params?.slug);
      if (!entry) {
        return notFoundResponse({ path: context.path, timestamp: context.timestamp });
      }

      const renderable = toRenderableEntry(entry);
      return toHtmlResponse(runtime.theme.renderPost({
        siteName: resolveSiteName(runtime),
        title: renderable.title,
        content: renderable.content
      }));
    }
  }
]);
