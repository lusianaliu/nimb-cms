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

const adminUiRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../ui/admin');

const adminContentTypeMap = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
});

const resolveAdminAssetPath = (requestPath) => {
  if (requestPath === '/admin' || requestPath === '/admin/') {
    return path.join(adminUiRoot, 'index.html');
  }

  if (!requestPath.startsWith('/admin/')) {
    return null;
  }

  const relativePath = requestPath.slice('/admin/'.length);
  if (!relativePath) {
    return path.join(adminUiRoot, 'index.html');
  }

  const candidate = path.resolve(adminUiRoot, relativePath);
  if (!candidate.startsWith(adminUiRoot)) {
    return null;
  }

  return candidate;
};

const trySendAdminAsset = (response, requestPath) => {
  const filePath = resolveAdminAssetPath(requestPath);
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

export const createHttpServer = ({ runtime, config, startupTimestamp, port = 3000, clock = () => new Date().toISOString(), authService, authMiddleware, adminController, contentRegistry, persistContentTypes }) => {
  const router = createRouter([
    createHealthRoute(),
    createRuntimeRoute({ config, runtime, startupTimestamp, clock }),
    createInspectorRoute({ runtime })
  ]);
  const apiRouter = createApiRouter({ runtime, authService, authMiddleware, adminController, contentRegistry, persistContentTypes });

  const server = http.createServer((request, response) => {
    const context = createRequestContext(request, { clock });

    Promise.resolve(apiRouter.handle(context))
      .then((apiResponse) => {
        if (apiResponse) {
          apiResponse.send(response);
          return;
        }

        const handler = router.dispatch(context);

        if (!handler) {
          if (trySendAdminAsset(response, context.path)) {
            return;
          }

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
      return new Promise((resolve) => {
        server.listen(port, () => {
          const address = server.address();
          const activePort = typeof address === 'object' && address ? address.port : port;
          resolve({ port: activePort });
        });
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
