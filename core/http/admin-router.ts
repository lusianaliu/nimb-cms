import fs from 'node:fs';
import path from 'node:path';
import { runMiddlewareStack } from './run-middleware.ts';
import { renderAdminDashboardPage } from '../admin/admin-dashboard-page.ts';
import { createPageController } from './page-controller.ts';
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

const loadAdminShell = (rootDirectory: string) => {
  const shellPath = path.resolve(rootDirectory, 'admin/index.html');

  if (!fs.existsSync(shellPath) || !fs.statSync(shellPath).isFile()) {
    return defaultAdminShell;
  }

  return fs.readFileSync(shellPath, 'utf8');
};

const resolveAdminAsset = (rootDirectory: string, requestPath: string) => {
  const relativePath = requestPath.replace(/^\/admin\/?/, '');

  if (!relativePath || relativePath.endsWith('/')) {
    return null;
  }

  const assetRoot = path.resolve(rootDirectory, 'admin');
  const assetPath = path.resolve(assetRoot, relativePath);

  if (assetPath.startsWith(`${assetRoot}${path.sep}`) && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    if (assetPath.endsWith('.js')) {
      return toStaticResponse(fs.readFileSync(assetPath), 'application/javascript; charset=utf-8');
    }

    if (assetPath.endsWith('.css')) {
      return toStaticResponse(fs.readFileSync(assetPath), 'text/css; charset=utf-8');
    }

    return null;
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

  return Object.freeze({
    dispatch(context) {
      if (context.path.startsWith('/admin-api/pages')) {
        return pageController.dispatch(context);
      }

      if (context.method !== 'GET') {
        return null;
      }

      if (context.path === normalizedBasePath || context.path === `${normalizedBasePath}/`) {
        return (requestContext) => withAdminMiddleware(runtime, requestContext, () => toHtmlResponse(renderAdminDashboardPage(runtime)));
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
