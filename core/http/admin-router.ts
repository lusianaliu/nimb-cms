import fs from 'node:fs';
import path from 'node:path';

const defaultAdminShell = `<!doctype html>
<html>
<head>
  <title>Nimb Admin</title>
</head>
<body>
  <div id="app"></div>
  <script src="/admin/app.js"></script>
</body>
</html>
`;

const defaultAdminApp = `const renderNavigation = async () => {
  const app = document.getElementById('app');

  if (!app) {
    return;
  }

  try {
    const response = await fetch('/admin-api/pages');
    if (!response.ok) {
      throw new Error('Failed to load admin pages');
    }

    const pages = await response.json();
    const titles = Array.isArray(pages)
      ? pages.map((page) => \`- \${page.title}\`)
      : [];

    app.innerHTML = ['Nimb Admin', '-----------', ...titles].join('<br>');
  } catch {
    app.innerHTML = ['Nimb Admin', '-----------', 'Navigation unavailable.'].join('<br>');
  }
};

void renderNavigation();
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
    return toStaticResponse(Buffer.from(defaultAdminApp, 'utf8'), 'application/javascript; charset=utf-8');
  }

  return null;
};

export const createAdminRouter = ({ rootDirectory = process.cwd() } = {}) => {
  const normalizedBasePath = '/admin';
  const shell = loadAdminShell(rootDirectory);

  return Object.freeze({
    dispatch(context) {
      if (context.method !== 'GET') {
        return null;
      }

      if (context.path === normalizedBasePath || context.path === `${normalizedBasePath}/`) {
        return () => toHtmlResponse(shell);
      }

      if (context.path.startsWith(`${normalizedBasePath}/`)) {
        const assetResponse = resolveAdminAsset(rootDirectory, context.path);
        if (assetResponse) {
          return () => assetResponse;
        }

        return () => toHtmlResponse(shell);
      }

      return null;
    }
  });
};
