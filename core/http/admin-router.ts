import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { runMiddlewareStack } from './run-middleware.ts';
import { renderAdminDashboardPage } from '../admin/admin-dashboard-page.ts';
import { renderAdminMediaPage } from '../admin/admin-media-page.ts';
import { renderAdminPageFormPage, renderAdminPagesListPage } from '../admin/admin-pages-page.ts';
import { renderAdminPostFormPage, renderAdminPostsListPage } from '../admin/admin-posts-page.ts';
import { renderAdminSettingsPage } from '../admin/admin-settings-page.ts';
import { createPageController } from './page-controller.ts';
import { createPostController } from './post-controller.ts';
import { resolvePagePublishState, resolvePostPublishState } from '../content/publish-timing.ts';
import type { MiddlewareContext } from './middleware.ts';

const defaultAdminShell = `<!doctype html>
<html>
<head>
  <title>Nimb Admin</title>
</head>
<body>
  <div id="admin-root"></div>
  <script src="/admin/app.js"></script>
</body>
</html>
`;

const defaultAdminApp = `const createQuickLinks = () => {
  const links = [
    { label: 'Content', href: '/admin/content/page' },
    { label: 'Media', href: '/admin/media' },
    { label: 'Settings', href: '/admin/settings' }
  ];

  const list = document.createElement('ul');

  links.forEach((link) => {
    const item = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label;
    item.append(anchor);
    list.append(item);
  });

  return list;
};

const renderDashboard = (systemInfo) => {
  const main = document.createElement('main');

  const title = document.createElement('h1');
  title.textContent = 'Welcome to Nimb';
  main.append(title);

  const success = document.createElement('p');
  success.textContent = 'Installation successful';
  main.append(success);

  const details = document.createElement('section');
  const detailsTitle = document.createElement('h2');
  detailsTitle.textContent = 'System';
  details.append(detailsTitle);

  const detailsList = document.createElement('ul');

  const siteNameItem = document.createElement('li');
  siteNameItem.textContent = 'Site: ' + (systemInfo?.siteName ?? 'My Nimb Site');
  detailsList.append(siteNameItem);

  const versionItem = document.createElement('li');
  versionItem.textContent = 'Version: ' + (systemInfo?.version ?? '0.0.0');
  detailsList.append(versionItem);

  const installedAtItem = document.createElement('li');
  installedAtItem.textContent = 'Installed at: ' + (systemInfo?.installedAt ?? 'Unknown');
  detailsList.append(installedAtItem);

  details.append(detailsList);
  main.append(details);

  const linksSection = document.createElement('section');
  const linksTitle = document.createElement('h2');
  linksTitle.textContent = 'Quick links';
  linksSection.append(linksTitle);
  linksSection.append(createQuickLinks());
  main.append(linksSection);

  return main;
};

const bootstrapLayout = () => {
  const root = document.getElementById('admin-root');
  if (!root) {
    return;
  }

  const loading = document.createElement('p');
  loading.textContent = 'Loading dashboard...';
  root.replaceChildren(loading);

  void fetch('/admin-api/system/info')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to load dashboard info: ' + response.status);
      }

      return response.json();
    })
    .then((systemInfo) => {
      root.replaceChildren(renderDashboard(systemInfo));
    })
    .catch(() => {
      root.replaceChildren(renderDashboard({}));
    });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLayout, { once: true });
} else {
  bootstrapLayout();
}
`;


const toHtmlResponse = (html: string) => ({
  statusCode: 200,
  send(response) {
    const body = Buffer.from(html, 'utf8');
    response.writeHead(200, {
      'content-length': body.byteLength,
      'content-type': 'text/html; charset=utf-8'
    });
    response.end(body);
  }
});

const toStaticResponse = (body: Buffer, contentType: string) => ({
  statusCode: 200,
  send(response) {
    response.writeHead(200, {
      'content-length': body.byteLength,
      'content-type': contentType
    });
    response.end(body);
  }
});

const toRedirectResponse = (location: string, statusCode = 302) => ({
  statusCode,
  send(response) {
    response.writeHead(statusCode, {
      location,
      'content-length': '0'
    });
    response.end();
  }
});

const toTextResponse = (statusCode: number, bodyText: string) => ({
  statusCode,
  send(response) {
    const body = Buffer.from(bodyText, 'utf8');
    response.writeHead(statusCode, {
      'content-length': body.byteLength,
      'content-type': 'text/plain; charset=utf-8'
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

const isPublishedEntry = (entry) => resolvePagePublishState(entry).isPublic;

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

const getNavigationPages = (runtime) => queryEntries(runtime, 'page', { sort: 'updatedAt desc', limit: 10 })
  .filter(isPublishedEntry)
  .filter((entry) => `${entry?.data?.slug ?? ''}` && `${entry?.data?.slug ?? ''}` !== 'home')
  .slice(0, 5)
  .map(toRenderableEntry);

const addPreviewBanner = (html: string, title: string, message: string) => {
  const banner = `<aside style="position:sticky;top:0;z-index:20;padding:10px 14px;background:#fffbeb;border-bottom:1px solid #f59e0b;color:#7c2d12;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><strong>${title}</strong><span style="display:block;margin-top:2px;">${message}</span></aside>`;

  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>${banner}`);
  }

  return `${banner}${html}`;
};

const parseFormBody = async (request) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
};


const slugify = (value: unknown) => `${value ?? ''}`
  .trim()
  .toLowerCase()
  .replaceAll(/[^a-z0-9\s-]/g, '')
  .replaceAll(/\s+/g, '-')
  .replaceAll(/-+/g, '-')
  .replaceAll(/^-|-$/g, '');

const normalizeStatus = (value: unknown) => `${value ?? ''}`.trim().toLowerCase() === 'draft' ? 'draft' : 'published';

const resolveStatusFromWorkflowAction = (workflowAction: unknown, fallbackStatus: unknown) => {
  const action = `${workflowAction ?? ''}`.trim().toLowerCase();
  if (action === 'save-draft') {
    return 'draft';
  }

  if (action === 'publish-now') {
    return 'published';
  }

  return normalizeStatus(fallbackStatus);
};


const resolvePageNoticeSuffix = (status: string, publishedAt: string) => {
  const publishState = resolvePagePublishState({
    data: {
      status,
      publishedAt
    }
  });

  return publishState.status === 'draft'
    ? 'draft'
    : publishState.status === 'scheduled'
      ? 'scheduled'
      : 'published';
};

const resolvePostNoticeSuffix = (status: string, publishedAt: string) => {
  const publishState = resolvePostPublishState({
    data: {
      status,
      publishedAt
    }
  });

  return publishState.status === 'draft'
    ? 'draft'
    : publishState.status === 'scheduled'
      ? 'scheduled'
      : 'published';
};

const isSlugTaken = (entries, candidate: string, currentId = '') => entries.some((entry) => {
  const entryId = `${entry?.id ?? ''}`;
  const slug = `${entry?.data?.slug ?? ''}`.trim().toLowerCase();
  return entryId !== currentId && slug === candidate.toLowerCase();
});

const formatApiError = (apiResponse, fallbackMessage: string) => {
  const message = `${apiResponse?.body?.error?.message ?? ''}`.trim();
  if (!message) {
    return fallbackMessage;
  }

  if (message.includes('title') && message.includes('slug')) {
    return 'Please enter both a title and a slug.';
  }

  if (message.includes('publishedAt')) {
    return 'Please enter a valid publish date and time, or leave it empty.';
  }

  return message;
};
const createJsonRequest = (method: string, payload?: Record<string, unknown>) => {
  const body = typeof payload === 'undefined' ? '' : JSON.stringify(payload);
  const request = Readable.from(body ? [Buffer.from(body, 'utf8')] : []);
  (request as Record<string, unknown>).headers = { 'content-type': 'application/json' };
  (request as Record<string, unknown>).method = method;
  return request;
};

const invokePageApi = async (pageController, context) => {
  const handler = pageController.dispatch(context);
  if (!handler) {
    return null;
  }

  const response = await Promise.resolve(handler(context));
  return response;
};

const loadAdminShell = (rootDirectory: string) => {
  const shellPath = path.resolve(rootDirectory, 'admin/index.html');

  if (!fs.existsSync(shellPath) || !fs.statSync(shellPath).isFile()) {
    return defaultAdminShell;
  }

  return fs.readFileSync(shellPath, 'utf8');
};

const resolveStaticAsset = (assetRoot: string, relativePath: string) => {
  const assetPath = path.resolve(assetRoot, relativePath);
  if (!assetPath.startsWith(`${assetRoot}${path.sep}`) || !fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    return null;
  }

  if (assetPath.endsWith('.js')) {
    return toStaticResponse(fs.readFileSync(assetPath), 'application/javascript; charset=utf-8');
  }

  if (assetPath.endsWith('.css')) {
    return toStaticResponse(fs.readFileSync(assetPath), 'text/css; charset=utf-8');
  }

  if (assetPath.endsWith('.svg')) {
    return toStaticResponse(fs.readFileSync(assetPath), 'image/svg+xml');
  }

  return toStaticResponse(fs.readFileSync(assetPath), 'application/octet-stream');
};

const resolveAdminAsset = (rootDirectory: string, requestPath: string) => {
  const relativePath = requestPath.replace(/^\/admin\/?/, '');

  if (!relativePath || relativePath.endsWith('/')) {
    return null;
  }

  const adminAsset = resolveStaticAsset(path.resolve(rootDirectory, 'admin'), relativePath);
  if (adminAsset) {
    return adminAsset;
  }

  const publicAdminAsset = resolveStaticAsset(path.resolve(rootDirectory, 'public/admin'), relativePath);
  if (publicAdminAsset) {
    return publicAdminAsset;
  }

  if (relativePath === 'app.js') {
    const candidatePaths = [
      path.resolve(rootDirectory, 'admin', 'app.js'),
      path.resolve(process.cwd(), 'admin', 'app.js')
    ];

    for (const bundledAppPath of candidatePaths) {
      if (fs.existsSync(bundledAppPath) && fs.statSync(bundledAppPath).isFile()) {
        return toStaticResponse(fs.readFileSync(bundledAppPath), 'application/javascript; charset=utf-8');
      }
    }

    return toStaticResponse(Buffer.from(defaultAdminApp, 'utf8'), 'application/javascript; charset=utf-8');
  }

  return null;
};

const withAdminMiddleware = (runtime, context, handler: () => Promise<unknown> | unknown) => {
  const middlewareContext: MiddlewareContext = {
    req: context.request,
    res: context.response,
    runtime,
    params: context.params,
    state: {}
  };

  let output: unknown = null;

  return runMiddlewareStack(
    middlewareContext,
    runtime?.admin?.middleware?.list?.() ?? [],
    async () => {
      output = await Promise.resolve(handler());
    }
  ).then(() => output ?? middlewareContext.state.response ?? null);
};

export const createAdminRouter = ({ rootDirectory = process.cwd(), runtime = null } = {}) => {
  const normalizedBasePath = '/admin';
  const shell = loadAdminShell(rootDirectory);
  const pageController = createPageController(runtime);
  const postController = createPostController(runtime);

  return Object.freeze({
    dispatch(context) {
      if (context.path.startsWith('/admin-api/pages')) {
        return pageController.dispatch(context);
      }

      if (context.path.startsWith('/admin-api/posts')) {
        return postController.dispatch(context);
      }


      const previewPageMatch = context.path.match(/^\/admin\/preview\/pages\/([^/]+)$/);
      if (previewPageMatch && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => {
          const id = decodeURIComponent(previewPageMatch[1]);
          const page = runtime.content.get('page', id);
          if (!page) {
            return toTextResponse(404, 'Page not found.');
          }

          const html = runtime?.themeRenderer?.renderTemplate?.('page', runtime, {
            routePath: requestContext.path,
            routeParams: { id },
            pages: getNavigationPages(runtime),
            page: toRenderableEntry(page)
          }) ?? '';

          return toHtmlResponse(addPreviewBanner(
            html,
            'Draft preview mode',
            'This preview is available only to signed-in admins and does not make the page public.'
          ));
        });
      }


      const unsavedPreviewPageMatch = context.path.match(/^\/admin\/preview\/pages\/([^/]+)\/unsaved$/);

      if (context.path === '/admin/preview/pages/new/unsaved' && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const formData = await parseFormBody(requestContext.request);
          const body = `${formData.body ?? ''}`;
          const previewPage = toRenderableEntry({
            id: 'new-unsaved-preview',
            type: 'page',
            data: {
              title: `${formData.title ?? ''}`,
              slug: `${formData.slug ?? ''}`.trim() || 'unsaved-page-preview',
              body,
              content: body,
              status: 'draft'
            }
          });

          const html = runtime?.themeRenderer?.renderTemplate?.('page', runtime, {
            routePath: requestContext.path,
            routeParams: { id: 'new', unsaved: '1', mode: 'new' },
            pages: getNavigationPages(runtime),
            page: previewPage
          }) ?? '';

          return toHtmlResponse(addPreviewBanner(
            html,
            'Unsaved new page preview mode',
            'You are previewing a brand-new unsaved page buffer. This preview is admin-only and does not create, save, or publish content.'
          ));
        });
      }

      if (unsavedPreviewPageMatch && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const id = decodeURIComponent(unsavedPreviewPageMatch[1]);
          const page = runtime.content.get('page', id);
          if (!page) {
            return toTextResponse(404, 'Page not found.');
          }

          const formData = await parseFormBody(requestContext.request);
          const body = `${formData.body ?? ''}`;
          const previewPage = toRenderableEntry({
            ...page,
            data: {
              ...page?.data,
              title: `${formData.title ?? page?.data?.title ?? ''}`,
              slug: `${formData.slug ?? page?.data?.slug ?? ''}`,
              body,
              content: body
            }
          });

          const html = runtime?.themeRenderer?.renderTemplate?.('page', runtime, {
            routePath: requestContext.path,
            routeParams: { id, unsaved: '1' },
            pages: getNavigationPages(runtime),
            page: previewPage
          }) ?? '';

          return toHtmlResponse(addPreviewBanner(
            html,
            'Unsaved preview mode',
            'You are previewing unsaved editor changes. This content is admin-only and was not saved or published.'
          ));
        });
      }

      const previewPostMatch = context.path.match(/^\/admin\/preview\/posts\/([^/]+)$/);

      const unsavedPreviewPostMatch = context.path.match(/^\/admin\/preview\/posts\/([^/]+)\/unsaved$/);

      if (context.path === '/admin/preview/posts/new/unsaved' && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const formData = await parseFormBody(requestContext.request);
          const body = `${formData.body ?? ''}`;
          const status = resolveStatusFromWorkflowAction(formData.workflowAction, formData.status);
          const publishedAtRaw = status === 'draft' ? '' : `${formData.publishedAt ?? ''}`.trim();
          const previewPost = toRenderableEntry({
            id: 'new-unsaved-preview',
            type: 'post',
            data: {
              title: `${formData.title ?? ''}`,
              slug: `${formData.slug ?? ''}`.trim() || 'unsaved-post-preview',
              body,
              content: body,
              status,
              publishedAt: publishedAtRaw
            }
          });

          const html = runtime?.themeRenderer?.renderTemplate?.('post-page', runtime, {
            routePath: requestContext.path,
            routeParams: { id: 'new', unsaved: '1', mode: 'new' },
            pages: getNavigationPages(runtime),
            post: previewPost
          }) ?? '';

          return toHtmlResponse(addPreviewBanner(
            html,
            'Unsaved new post preview mode',
            'You are previewing a brand-new unsaved post buffer. This preview is admin-only and does not create, save, or publish content.'
          ));
        });
      }

      if (unsavedPreviewPostMatch && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const id = decodeURIComponent(unsavedPreviewPostMatch[1]);
          const post = runtime.content.get('post', id);
          if (!post) {
            return toTextResponse(404, 'Post not found.');
          }

          const formData = await parseFormBody(requestContext.request);
          const body = `${formData.body ?? ''}`;
          const status = resolveStatusFromWorkflowAction(formData.workflowAction, formData.status);
          const publishedAtRaw = status === 'draft' ? '' : `${formData.publishedAt ?? ''}`.trim();
          const previewPost = toRenderableEntry({
            ...post,
            data: {
              ...post?.data,
              title: `${formData.title ?? post?.data?.title ?? ''}`,
              slug: `${formData.slug ?? post?.data?.slug ?? ''}`,
              body,
              content: body,
              status,
              publishedAt: publishedAtRaw
            }
          });

          const html = runtime?.themeRenderer?.renderTemplate?.('post-page', runtime, {
            routePath: requestContext.path,
            routeParams: { id, unsaved: '1' },
            pages: getNavigationPages(runtime),
            post: previewPost
          }) ?? '';

          return toHtmlResponse(addPreviewBanner(
            html,
            'Unsaved preview mode',
            'You are previewing unsaved editor changes. This content is admin-only and was not saved or published.'
          ));
        });
      }

      if (previewPostMatch && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => {
          const id = decodeURIComponent(previewPostMatch[1]);
          const post = runtime.content.get('post', id);
          if (!post) {
            return toTextResponse(404, 'Post not found.');
          }

          const html = runtime?.themeRenderer?.renderTemplate?.('post-page', runtime, {
            routePath: requestContext.path,
            routeParams: { id },
            pages: getNavigationPages(runtime),
            post: toRenderableEntry(post)
          }) ?? '';

          return toHtmlResponse(addPreviewBanner(
            html,
            'Draft preview mode',
            'This preview is available only to signed-in admins and does not make the post public.'
          ));
        });
      }

      if (context.path === '/admin/pages' && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const apiResponse = await invokePageApi(pageController, {
            method: 'GET',
            path: '/admin-api/pages',
            params: {},
            request: createJsonRequest('GET')
          });

          if (!apiResponse || apiResponse.statusCode !== 200) {
            return toTextResponse(500, 'Failed to load pages.');
          }

          const noticeKey = `${requestContext.query?.notice ?? ''}`;
          const notice = noticeKey === 'created'
            ? { tone: 'success' as const, title: 'Page saved', message: 'Your page was saved successfully.' }
            : noticeKey === 'created-draft'
              ? { tone: 'success' as const, title: 'Draft saved', message: 'Your page draft was saved and is hidden from the public site.' }
              : noticeKey === 'created-published'
                ? { tone: 'success' as const, title: 'Page published', message: 'Your page is now visible on the public site.' }
              : noticeKey === 'created-scheduled'
                ? { tone: 'success' as const, title: 'Page scheduled', message: 'Your page is scheduled and will stay hidden until its publish date/time.' }
            : noticeKey === 'updated'
              ? { tone: 'success' as const, title: 'Page saved', message: 'Your page changes were saved successfully.' }
              : noticeKey === 'updated-draft'
                ? { tone: 'success' as const, title: 'Draft saved', message: 'Your page draft changes were saved.' }
                : noticeKey === 'updated-published'
                  ? { tone: 'success' as const, title: 'Page published', message: 'Your page changes were published to the public site.' }
                : noticeKey === 'updated-scheduled'
                  ? { tone: 'success' as const, title: 'Page scheduled', message: 'Your page changes are scheduled and will stay hidden until their publish date/time.' }
              : noticeKey === 'deleted'
                ? { tone: 'success' as const, title: 'Page deleted', message: 'The page was deleted.' }
                : null;

          const pages = runtime.content.list('page');
          return toHtmlResponse(renderAdminPagesListPage({ pages, runtime, notice }));
        });
      }

      if (context.path === '/admin/pages/new' && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => toHtmlResponse(renderAdminPageFormPage({ mode: 'new', runtime })));
      }

      if (context.path === '/admin/pages/new' && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const formData = await parseFormBody(requestContext.request);
          const title = `${formData.title ?? ''}`.trim();
          const body = `${formData.body ?? ''}`;
          const normalizedSlug = slugify(`${formData.slug ?? ''}`.trim() || title);
          const status = resolveStatusFromWorkflowAction(formData.workflowAction, formData.status);
          const publishedAtRaw = status === 'draft' ? '' : `${formData.publishedAt ?? ''}`.trim();
          const pages = runtime.content.list('page');

          const errors: string[] = [];
          if (!title) {
            errors.push('Page title is required.');
          }
          if (!normalizedSlug) {
            errors.push('Page URL slug is required.');
          }
          if (normalizedSlug && isSlugTaken(pages, normalizedSlug)) {
            errors.push('This page URL slug is already used. Please choose another one.');
          }

          if (errors.length > 0) {
            return toHtmlResponse(renderAdminPageFormPage({
              mode: 'new',
              runtime,
              values: { title, slug: normalizedSlug, body, status, publishedAt: publishedAtRaw },
              errors
            }));
          }

          const payload = { title, slug: normalizedSlug, body, status, publishedAt: publishedAtRaw };
          const apiResponse = await invokePageApi(pageController, {
            method: 'POST',
            path: '/admin-api/pages',
            params: {},
            request: createJsonRequest('POST', payload)
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toHtmlResponse(renderAdminPageFormPage({
              mode: 'new',
              runtime,
              values: { title, slug: normalizedSlug, body, status, publishedAt: publishedAtRaw },
              errors: [formatApiError(apiResponse, 'Failed to create page. Please review the form and try again.')]
            }));
          }

          const noticeSuffix = resolvePageNoticeSuffix(status, publishedAtRaw);
          return toRedirectResponse(`/admin/pages?notice=created-${noticeSuffix}`);
        });
      }

      const editMatch = context.path.match(/^\/admin\/pages\/([^/]+)\/edit$/);
      if (editMatch && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const id = decodeURIComponent(editMatch[1]);
          const page = runtime.content.get('page', id);
          if (!page) {
            return toTextResponse(404, 'Page not found.');
          }

          const apiResponse = await invokePageApi(pageController, {
            method: 'GET',
            path: `/admin-api/pages/${encodeURIComponent(id)}`,
            params: { id },
            request: createJsonRequest('GET')
          });

          if (!apiResponse || apiResponse.statusCode !== 200) {
            return toTextResponse(404, 'Page not found.');
          }

          return toHtmlResponse(renderAdminPageFormPage({ mode: 'edit', page, runtime }));
        });
      }

      if (editMatch && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const id = decodeURIComponent(editMatch[1]);
          const page = runtime.content.get('page', id);
          if (!page) {
            return toTextResponse(404, 'Page not found.');
          }

          const formData = await parseFormBody(requestContext.request);
          const title = `${formData.title ?? ''}`.trim();
          const body = `${formData.body ?? ''}`;
          const normalizedSlug = slugify(`${formData.slug ?? ''}`.trim() || title);
          const status = resolveStatusFromWorkflowAction(formData.workflowAction, formData.status);
          const publishedAtRaw = status === 'draft' ? '' : `${formData.publishedAt ?? ''}`.trim();
          const pages = runtime.content.list('page');

          const errors: string[] = [];
          if (!title) {
            errors.push('Page title is required.');
          }
          if (!normalizedSlug) {
            errors.push('Page URL slug is required.');
          }
          if (normalizedSlug && isSlugTaken(pages, normalizedSlug, id)) {
            errors.push('This page URL slug is already used. Please choose another one.');
          }

          if (errors.length > 0) {
            return toHtmlResponse(renderAdminPageFormPage({
              mode: 'edit',
              page,
              runtime,
              values: { title, slug: normalizedSlug, body, status, publishedAt: publishedAtRaw },
              errors
            }));
          }

          const payload = { title, slug: normalizedSlug, body, status, publishedAt: publishedAtRaw };
          const apiResponse = await invokePageApi(pageController, {
            method: 'PUT',
            path: `/admin-api/pages/${encodeURIComponent(id)}`,
            params: { id },
            request: createJsonRequest('PUT', payload)
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toHtmlResponse(renderAdminPageFormPage({
              mode: 'edit',
              page,
              runtime,
              values: { title, slug: normalizedSlug, body, status, publishedAt: publishedAtRaw },
              errors: [formatApiError(apiResponse, 'Failed to update page. Please review the form and try again.')]
            }));
          }

          const noticeSuffix = resolvePageNoticeSuffix(status, publishedAtRaw);
          return toRedirectResponse(`/admin/pages?notice=updated-${noticeSuffix}`);
        });
      }

      const deleteMatch = context.path.match(/^\/admin\/pages\/([^/]+)\/delete$/);
      if (deleteMatch && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const id = decodeURIComponent(deleteMatch[1]);
          const apiResponse = await invokePageApi(pageController, {
            method: 'DELETE',
            path: `/admin-api/pages/${encodeURIComponent(id)}`,
            params: { id },
            request: createJsonRequest('DELETE')
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toTextResponse(404, 'Page not found.');
          }

          return toRedirectResponse('/admin/pages?notice=deleted');
        });
      }

      if (context.path === '/admin/posts' && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const noticeKey = `${requestContext.query?.notice ?? ''}`;
          const notice = noticeKey === 'created'
            ? { tone: 'success' as const, title: 'Post saved', message: 'Your post was saved successfully.' }
            : noticeKey === 'created-draft'
              ? { tone: 'success' as const, title: 'Draft saved', message: 'Your draft post was saved and is hidden from your blog.' }
              : noticeKey === 'created-published'
                ? { tone: 'success' as const, title: 'Post published', message: 'Your post is now visible on your blog.' }
                : noticeKey === 'created-scheduled'
                  ? { tone: 'success' as const, title: 'Post scheduled', message: 'Your post is scheduled and will stay hidden until its publish date/time.' }
            : noticeKey === 'updated'
              ? { tone: 'success' as const, title: 'Post saved', message: 'Your post changes were saved successfully.' }
              : noticeKey === 'updated-draft'
                ? { tone: 'success' as const, title: 'Draft saved', message: 'Your post draft changes were saved.' }
                : noticeKey === 'updated-published'
                  ? { tone: 'success' as const, title: 'Post published', message: 'Your post changes were published to your blog.' }
                  : noticeKey === 'updated-scheduled'
                    ? { tone: 'success' as const, title: 'Post scheduled', message: 'Your post changes are scheduled and will stay hidden until their publish date/time.' }
              : noticeKey === 'deleted'
                ? { tone: 'success' as const, title: 'Post deleted', message: 'The post was deleted.' }
                : null;

          const posts = runtime.content.list('post');
          return toHtmlResponse(renderAdminPostsListPage({ posts, runtime, notice }));
        });
      }

      if (context.path === '/admin/media' && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => toHtmlResponse(renderAdminMediaPage(runtime)));
      }

      if (context.path === '/admin/settings' && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => toHtmlResponse(renderAdminSettingsPage(runtime?.settings?.getSettings?.() ?? {}, runtime)));
      }

      if (context.path === '/admin/posts/new' && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => toHtmlResponse(renderAdminPostFormPage({ mode: 'new', runtime })));
      }

      if (context.path === '/admin/posts/new' && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const formData = await parseFormBody(requestContext.request);
          const title = `${formData.title ?? ''}`.trim();
          const body = `${formData.body ?? ''}`;
          const normalizedSlug = slugify(`${formData.slug ?? ''}`.trim() || title);
          const status = resolveStatusFromWorkflowAction(formData.workflowAction, formData.status);
          const publishedAtRaw = status === 'draft' ? '' : `${formData.publishedAt ?? ''}`.trim();
          const posts = runtime.content.list('post');

          const errors: string[] = [];
          if (!title) {
            errors.push('Post title is required.');
          }
          if (!normalizedSlug) {
            errors.push('Post URL slug is required.');
          }
          if (normalizedSlug && isSlugTaken(posts, normalizedSlug)) {
            errors.push('This post URL slug is already used. Please choose another one.');
          }

          const payload = {
            title,
            slug: normalizedSlug,
            body,
            publishedAt: publishedAtRaw,
            status
          };

          if (errors.length > 0) {
            return toHtmlResponse(renderAdminPostFormPage({
              mode: 'edit',
              post,
              runtime,
              values: payload,
              errors
            }));
          }

          const apiResponse = await invokePageApi(postController, {
            method: 'POST',
            path: '/admin-api/posts',
            params: {},
            request: createJsonRequest('POST', payload)
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toHtmlResponse(renderAdminPostFormPage({
              mode: 'new',
              runtime,
              values: payload,
              errors: [formatApiError(apiResponse, 'Failed to create post. Please review the form and try again.')]
            }));
          }

          const noticeSuffix = resolvePostNoticeSuffix(status, publishedAtRaw);
          return toRedirectResponse(`/admin/posts?notice=created-${noticeSuffix}`);
        });
      }

      const editPostMatch = context.path.match(/^\/admin\/posts\/([^/]+)\/edit$/);
      if (editPostMatch && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const id = decodeURIComponent(editPostMatch[1]);
          const post = runtime.content.get('post', id);
          if (!post) {
            return toTextResponse(404, 'Post not found.');
          }

          const apiResponse = await invokePageApi(postController, {
            method: 'GET',
            path: `/admin-api/posts/${encodeURIComponent(id)}`,
            params: { id },
            request: createJsonRequest('GET')
          });

          if (!apiResponse || apiResponse.statusCode !== 200) {
            return toTextResponse(404, 'Post not found.');
          }

          return toHtmlResponse(renderAdminPostFormPage({ mode: 'edit', post, runtime }));
        });
      }

      if (editPostMatch && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const id = decodeURIComponent(editPostMatch[1]);
          const post = runtime.content.get('post', id);
          if (!post) {
            return toTextResponse(404, 'Post not found.');
          }

          const formData = await parseFormBody(requestContext.request);
          const title = `${formData.title ?? ''}`.trim();
          const body = `${formData.body ?? ''}`;
          const normalizedSlug = slugify(`${formData.slug ?? ''}`.trim() || title);
          const status = resolveStatusFromWorkflowAction(formData.workflowAction, formData.status);
          const publishedAtRaw = status === 'draft' ? '' : `${formData.publishedAt ?? ''}`.trim();
          const posts = runtime.content.list('post');

          const errors: string[] = [];
          if (!title) {
            errors.push('Post title is required.');
          }
          if (!normalizedSlug) {
            errors.push('Post URL slug is required.');
          }
          if (normalizedSlug && isSlugTaken(posts, normalizedSlug, id)) {
            errors.push('This post URL slug is already used. Please choose another one.');
          }

          const payload = {
            title,
            slug: normalizedSlug,
            body,
            publishedAt: publishedAtRaw,
            status
          };

          if (errors.length > 0) {
            return toHtmlResponse(renderAdminPostFormPage({
              mode: 'edit',
              post,
              runtime,
              values: payload,
              errors
            }));
          }

          const apiResponse = await invokePageApi(postController, {
            method: 'PUT',
            path: `/admin-api/posts/${encodeURIComponent(id)}`,
            params: { id },
            request: createJsonRequest('PUT', payload)
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toHtmlResponse(renderAdminPostFormPage({
              mode: 'edit',
              post,
              runtime,
              values: payload,
              errors: [formatApiError(apiResponse, 'Failed to update post. Please review the form and try again.')]
            }));
          }

          const noticeSuffix = resolvePostNoticeSuffix(status, publishedAtRaw);
          return toRedirectResponse(`/admin/posts?notice=updated-${noticeSuffix}`);
        });
      }

      const deletePostMatch = context.path.match(/^\/admin\/posts\/([^/]+)\/delete$/);
      if (deletePostMatch && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const id = decodeURIComponent(deletePostMatch[1]);
          const apiResponse = await invokePageApi(postController, {
            method: 'DELETE',
            path: `/admin-api/posts/${encodeURIComponent(id)}`,
            params: { id },
            request: createJsonRequest('DELETE')
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toTextResponse(404, 'Post not found.');
          }

          return toRedirectResponse('/admin/posts?notice=deleted');
        });
      }

      if (context.method !== 'GET') {
        return null;
      }

      if (context.path === normalizedBasePath || context.path === `${normalizedBasePath}/`) {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => toHtmlResponse(renderAdminDashboardPage(runtime, { welcome: `${requestContext.query?.welcome ?? ''}` === '1' })));
      }

      if (context.path.startsWith(`${normalizedBasePath}/`)) {
        const assetResponse = resolveAdminAsset(rootDirectory, context.path);
        if (assetResponse) {
          return () => assetResponse;
        }

        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => toHtmlResponse(shell));
      }

      return null;
    }
  });
};
