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

const defaultAdminApp = `const renderSystemPanel = async () => {
  const app = document.getElementById('app');

  if (!app) {
    return;
  }

  try {
    const response = await fetch('/admin-api/system');
    if (!response.ok) {
      throw new Error('Failed to load system info');
    }

    const system = await response.json();
    app.innerHTML = [
      'Nimb Admin',
      '-----------',
      \`Name: \${system.name}\`,
      \`Version: \${system.version}\`,
      \`Mode: \${system.mode}\`,
      \`Installed: \${system.installed}\`
    ].join('<br>');
  } catch {
    app.innerHTML = ['Nimb Admin', '-----------', 'System status unavailable.'].join('<br>');
  }
};

void renderSystemPanel();
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
