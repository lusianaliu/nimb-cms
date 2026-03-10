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

const parseFormBody = async (request) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
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
    const bundledAppPath = path.resolve(process.cwd(), 'admin', 'app.js');

    if (fs.existsSync(bundledAppPath) && fs.statSync(bundledAppPath).isFile()) {
      return toStaticResponse(fs.readFileSync(bundledAppPath), 'application/javascript; charset=utf-8');
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

          const pages = runtime.content.list('page');
          return toHtmlResponse(renderAdminPagesListPage({ pages, runtime }));
        });
      }

      if (context.path === '/admin/pages/new' && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => toHtmlResponse(renderAdminPageFormPage({ mode: 'new', runtime })));
      }

      if (context.path === '/admin/pages/new' && context.method === 'POST') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const formData = await parseFormBody(requestContext.request);
          const payload = {
            title: `${formData.title ?? ''}`,
            slug: `${formData.slug ?? ''}`,
            body: `${formData.body ?? ''}`
          };

          const apiResponse = await invokePageApi(pageController, {
            method: 'POST',
            path: '/admin-api/pages',
            params: {},
            request: createJsonRequest('POST', payload)
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toTextResponse(400, 'Failed to create page.');
          }

          return toRedirectResponse('/admin/pages');
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
          const formData = await parseFormBody(requestContext.request);
          const payload = {
            title: `${formData.title ?? ''}`,
            slug: `${formData.slug ?? ''}`,
            body: `${formData.body ?? ''}`
          };

          const apiResponse = await invokePageApi(pageController, {
            method: 'PUT',
            path: `/admin-api/pages/${encodeURIComponent(id)}`,
            params: { id },
            request: createJsonRequest('PUT', payload)
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toTextResponse(400, 'Failed to update page.');
          }

          return toRedirectResponse('/admin/pages');
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

          return toRedirectResponse('/admin/pages');
        });
      }

      if (context.path === '/admin/posts' && context.method === 'GET') {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, async () => {
          const posts = runtime.content.list('post');
          return toHtmlResponse(renderAdminPostsListPage({ posts, runtime }));
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
          const payload = {
            title: `${formData.title ?? ''}`,
            slug: `${formData.slug ?? ''}`,
            body: `${formData.body ?? ''}`,
            publishedAt: `${formData.publishedAt ?? ''}`
          };

          const apiResponse = await invokePageApi(postController, {
            method: 'POST',
            path: '/admin-api/posts',
            params: {},
            request: createJsonRequest('POST', payload)
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toTextResponse(400, 'Failed to create post.');
          }

          return toRedirectResponse('/admin/posts');
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
          const formData = await parseFormBody(requestContext.request);
          const payload = {
            title: `${formData.title ?? ''}`,
            slug: `${formData.slug ?? ''}`,
            body: `${formData.body ?? ''}`,
            publishedAt: `${formData.publishedAt ?? ''}`
          };

          const apiResponse = await invokePageApi(postController, {
            method: 'PUT',
            path: `/admin-api/posts/${encodeURIComponent(id)}`,
            params: { id },
            request: createJsonRequest('PUT', payload)
          });

          if (!apiResponse || apiResponse.statusCode >= 400) {
            return toTextResponse(400, 'Failed to update post.');
          }

          return toRedirectResponse('/admin/posts');
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

          return toRedirectResponse('/admin/posts');
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
