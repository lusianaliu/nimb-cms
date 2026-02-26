import fs from 'node:fs';
import path from 'node:path';

const defaultAdminShell = `<!doctype html>
<html>
<head>
  <title>Nimb Admin</title>
</head>
<body>
  <div id="app">Loading Admin...</div>
</body>
</html>
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

const loadAdminShell = (rootDirectory: string) => {
  const shellPath = path.resolve(rootDirectory, 'admin/index.html');

  if (!fs.existsSync(shellPath) || !fs.statSync(shellPath).isFile()) {
    return defaultAdminShell;
  }

  return fs.readFileSync(shellPath, 'utf8');
};

export const createAdminRouter = ({ rootDirectory = process.cwd() } = {}) => {
  const normalizedBasePath = '/admin';
  const shell = loadAdminShell(rootDirectory);

  return Object.freeze({
    dispatch(context) {
      if (context.method !== 'GET') {
        return null;
      }

      if (context.path === normalizedBasePath || context.path.startsWith(`${normalizedBasePath}/`)) {
        return () => toHtmlResponse(shell);
      }

      return null;
    }
  });
};
