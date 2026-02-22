import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequestContext } from './request-context.ts';
import { createRouter } from './router.ts';
import { createHealthRoute } from './routes/health.ts';
import { createRuntimeRoute } from './routes/runtime.ts';
import { createInspectorRoute } from './routes/inspector.ts';
import { createApiRouter } from '../api/index.ts';
import { errorResponse, notFoundResponse } from './response.ts';

const adminContentTypeMap = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
});

const normalizeAdminMount = (basePath) => {
  const value = String(basePath ?? '/admin').trim() || '/admin';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/g, '') || '/';
};

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

export const createHttpServer = ({ runtime, config, startupTimestamp, rootDirectory = process.cwd(), port = 3000, clock = () => new Date().toISOString(), authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries }) => {
  const router = createRouter([
    createHealthRoute(),
    createRuntimeRoute({ config, runtime, startupTimestamp, clock }),
    createInspectorRoute({ runtime })
  ]);
  const apiRouter = createApiRouter({ runtime, authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries });
  const adminMount = Object.freeze({
    enabled: config?.admin?.enabled === true,
    basePath: normalizeAdminMount(config?.admin?.basePath),
    uiRoot: path.resolve(rootDirectory, config?.admin?.staticDir ?? './ui/admin')
  });

  const server = http.createServer((request, response) => {
    const context = createRequestContext(request, { clock });

    Promise.resolve(apiRouter.handle(context))
      .then((apiResponse) => {
        if (apiResponse) {
          apiResponse.send(response);
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

        const routeResponse = handler(context);
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
