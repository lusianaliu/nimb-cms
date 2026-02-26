import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequestContext } from './request-context.ts';
import { createRouter } from './router.ts';
import { createHealthRoute } from './routes/health.ts';
import { createRuntimeRoute } from './routes/runtime.ts';
import { createInspectorRoute } from './routes/inspector.ts';
import { registerContentApiRoutes } from './routes/content-api.ts';
import { createApiRouter } from '../api/index.ts';
import { errorResponse, notFoundResponse, redirectResponse } from './response.ts';
import { installerGate } from './installer-gate.ts';
import { handleInstall } from '../installer/install-controller.ts';
import { renderInstallPage } from '../installer/install-page.ts';
import { renderDashboardPage } from '../admin/dashboard-page.ts';
import { createAdminAuth } from '../admin/admin-auth.ts';
import { resolveAdminBasePath } from '../admin/resolve-admin-path.ts';
import { createInstallRouter } from '../install/install-router.ts';
import { createSiteRouter } from './site-router.ts';

const adminContentTypeMap = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
});

const resolveAdminAssetPath = ({ requestPath, adminBasePath, adminUiRoot }) => {
  if (requestPath === adminBasePath || requestPath === `${adminBasePath}/`) {
    return path.join(adminUiRoot, 'index.html');
  }

  if (!requestPath.startsWith(`${adminBasePath}/`)) {
    return null;
  }

  const relativePath = requestPath.slice(`${adminBasePath}/`.length);
  if (!relativePath) {
    return path.join(adminUiRoot, 'index.html');
  }

  const candidate = path.resolve(adminUiRoot, relativePath);
  if (!candidate.startsWith(adminUiRoot)) {
    return null;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  return path.join(adminUiRoot, 'index.html');
};


const resolvePublicRoot = ({ runtime, rootDirectory }) => {
  const projectRoot = runtime?.projectPaths?.projectRoot ?? runtime?.project?.projectRoot;
  const publicDir = runtime?.projectPaths?.publicDir ?? runtime?.project?.publicDir;

  if (typeof publicDir === 'string' && publicDir.trim() !== '') {
    return publicDir;
  }

  const baseRoot = typeof projectRoot === 'string' && projectRoot.trim() !== '' ? projectRoot : rootDirectory;
  return path.resolve(baseRoot, 'public');
};

const trySendPublicIndex = (response, requestPath, publicRoot) => {
  if (requestPath !== '/') {
    return false;
  }

  const filePath = path.join(publicRoot, 'index.html');
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const body = fs.readFileSync(filePath);
  response.writeHead(200, {
    'content-length': body.byteLength,
    'content-type': 'text/html; charset=utf-8'
  });
  response.end(body);
  return true;
};

const trySendAdminAsset = (response, requestPath, adminMount) => {
  if (!adminMount.enabled) {
    return false;
  }

  const filePath = resolveAdminAssetPath({ requestPath, adminBasePath: adminMount.basePath, adminUiRoot: adminMount.uiRoot });
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = adminContentTypeMap[extension] ?? 'application/octet-stream';
  const body = fs.readFileSync(filePath);

  response.writeHead(200, {
    'content-length': body.byteLength,
    'content-type': contentType
  });
  response.end(body);
  return true;
};

const renderAdminLoginPage = (adminLoginPath) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nimb Admin Login</title>
  </head>
  <body>
    <main>
      <h1>Nimb Admin Login</h1>
      <form method="post" action="${adminLoginPath}">
        <label for="username">Username</label>
        <input id="username" name="username" type="text" value="admin" required>

        <label for="password">Password</label>
        <input id="password" name="password" type="password" value="admin" required>

        <button type="submit">Login</button>
      </form>
    </main>
  </body>
</html>`;

const readRequestBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => resolve(body));
  request.on('error', (error) => reject(error));
});

const parseLoginRequest = (body) => {
  const params = new URLSearchParams(body ?? '');
  return Object.freeze({
    username: `${params.get('username') ?? ''}`,
    password: `${params.get('password') ?? ''}`
  });
};

const tryHandleAdminDashboardRequest = ({ context, response, runtime, adminBasePath, adminLoginPath, adminAuth }) => {
  if (runtime?.getRuntimeMode?.() !== 'normal' || context.path !== adminBasePath) {
    return false;
  }

  if (!adminAuth.getSessionFromRequest(context.request)) {
    redirectResponse(adminLoginPath).send(response);
    return true;
  }

  const body = Buffer.from(renderDashboardPage({ runtime, adminBasePath }), 'utf8');
  response.writeHead(200, {
    'content-length': body.byteLength,
    'content-type': 'text/html; charset=utf-8'
  });
  response.end(body);
  return true;
};

export const createHttpServer = ({ runtime, config, startupTimestamp, rootDirectory = process.cwd(), port = 3000, clock = () => new Date().toISOString(), authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries }) => {
  const installMode = runtime?.mode === 'install';

  const runtimeRouter = createRouter([
    createHealthRoute({ config }),
    createRuntimeRoute({ config, runtime, startupTimestamp, clock }),
    createInspectorRoute({ runtime })
  ]);
  if (!installMode) {
    registerContentApiRoutes(runtimeRouter, runtime);
  }

  const installRouter = createInstallRouter(runtime);
  const siteRouter = !installMode && runtime?.mode === 'runtime' ? createSiteRouter(runtime) : null;
  const router = installMode ? installRouter : runtimeRouter;
  const apiRouter = installMode
    ? { handle: async () => null }
    : createApiRouter({ runtime, authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries });
  const adminBasePath = runtime?.adminBasePath ?? resolveAdminBasePath(runtime);
  const adminLoginPath = `${adminBasePath}/login`;
  const adminMount = Object.freeze({
    enabled: config?.admin?.enabled === true,
    basePath: adminBasePath,
    uiRoot: path.resolve(rootDirectory, config?.admin?.staticDir ?? './ui/admin')
  });
  const gateRequest = installerGate(runtime);
  const publicRoot = resolvePublicRoot({ runtime, rootDirectory });
  const adminAuth = createAdminAuth({
    projectPaths: runtime?.projectPaths ?? runtime?.project ?? { projectRoot: rootDirectory },
    sessionCookiePath: adminBasePath
  });

  const server = http.createServer((request, response) => {
    const context = createRequestContext(request, { clock });

    Promise.resolve()
      .then(async () => {
        const apiResponse = await apiRouter.handle(context);
        if (apiResponse) {
          apiResponse.send(response);
          return;
        }

        if (!installMode) {
          const gateResponse = await gateRequest(context, () => null);
          if (gateResponse) {
            gateResponse.send(response);
            return;
          }
        }

        if (!installMode && context.path === '/install') {
          if (context.method === 'GET') {
            if (runtime?.getRuntimeMode?.() !== 'installer') {
              notFoundResponse({ path: context.path, timestamp: context.timestamp }).send(response);
              return;
            }

            const body = Buffer.from(renderInstallPage(), 'utf8');
            response.writeHead(200, {
              'content-length': body.byteLength,
              'content-type': 'text/html; charset=utf-8'
            });
            response.end(body);
            return;
          }

          if (context.method === 'POST') {
            (await handleInstall(context.request, runtime)).send(response);
            return;
          }
        }

        if (tryHandleAdminDashboardRequest({ context, response, runtime, adminBasePath, adminLoginPath, adminAuth })) {
          return;
        }

        if (runtime?.getRuntimeMode?.() === 'normal' && context.path === adminLoginPath) {
          if (context.method === 'GET') {
            const body = Buffer.from(renderAdminLoginPage(adminLoginPath), 'utf8');
            response.writeHead(200, {
              'content-length': body.byteLength,
              'content-type': 'text/html; charset=utf-8'
            });
            response.end(body);
            return;
          }

          if (context.method === 'POST') {
            const body = await readRequestBody(context.request);
            const credentials = parseLoginRequest(body);
            const token = adminAuth.login(credentials);

            if (!token) {
              response.writeHead(401, {
                'content-length': '0'
              });
              response.end();
              return;
            }

            response.writeHead(302, {
              location: adminBasePath,
              'set-cookie': `${adminAuth.cookieName}=${encodeURIComponent(token)}; Path=${adminAuth.sessionCookiePath}; HttpOnly; SameSite=Lax`,
              'content-length': '0'
            });
            response.end();
            return;
          }
        }

        if (siteRouter) {
          const siteHandler = siteRouter.dispatch(context);
          if (siteHandler) {
            const siteResponse = await Promise.resolve(siteHandler(context));
            siteResponse.send(response);
            return;
          }
        }

        if (trySendPublicIndex(response, context.path, publicRoot)) {
          return;
        }

        if (trySendAdminAsset(response, context.path, adminMount)) {
          return;
        }

        const handler = router.dispatch(context);

        if (!handler) {
          notFoundResponse({ path: context.path, timestamp: context.timestamp }).send(response);
          return;
        }

        const routeResponse = await Promise.resolve(handler(context));
        routeResponse.send(response);
      })
      .catch((error) => {
        errorResponse({
          code: 'HTTP_ROUTE_FAILURE',
          message: error?.message ?? 'Route execution failed',
          timestamp: context.timestamp
        }).send(response);
      });
  });

  return Object.freeze({
    port,
    start() {
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('listening', onListening);
          reject(new Error(`Failed to start HTTP server on port ${port}: ${error?.message ?? 'unknown error'}`));
        };

        const onListening = () => {
          server.off('error', onError);
          const address = server.address();
          const activePort = typeof address === 'object' && address ? address.port : port;

          if (runtime?.getRuntimeMode?.() === 'installer') {
            process.stdout.write('installer HTTP gate: active\n');
          }

          resolve({ port: activePort });
        };

        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port);
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(undefined);
        });
      });
    }
  });
};
