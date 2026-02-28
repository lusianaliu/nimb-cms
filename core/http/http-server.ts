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
import { errorResponse, notFoundResponse } from './response.ts';
import { installerGate } from './installer-gate.ts';
import { handleInstall } from '../installer/install-controller.ts';
import { renderInstallPage } from '../installer/install-page.ts';
import { createInstallRouter } from '../install/install-router.ts';
import { createSiteRouter } from './site-router.ts';
import { createAdminRouter } from './admin-router.ts';
import { createAdminApiRouter } from './admin-api-router.ts';

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
  const adminRouter = !installMode && runtime?.mode === 'runtime'
    ? createAdminRouter({ rootDirectory })
    : null;
  const adminApiRouter = !installMode && runtime?.mode === 'runtime'
    ? createAdminApiRouter(runtime)
    : null;
  const router = installMode ? installRouter : runtimeRouter;
  const apiRouter = installMode
    ? { handle: async () => null }
    : createApiRouter({ runtime, authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries });
  const gateRequest = installerGate(runtime);
  const publicRoot = resolvePublicRoot({ runtime, rootDirectory });

  const server = http.createServer((request, response) => {
    const context = createRequestContext(request, { clock });

    Promise.resolve()
      .then(async () => {
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

        if (adminRouter) {
          const adminHandler = adminRouter.dispatch(context);
          if (adminHandler) {
            const adminResponse = await Promise.resolve(adminHandler(context));
            adminResponse.send(response);
            return;
          }
        }

        if (adminApiRouter) {
          const adminApiHandler = adminApiRouter.dispatch(context);
          if (adminApiHandler) {
            const adminApiResponse = await Promise.resolve(adminApiHandler(context));
            adminApiResponse.send(response);
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

        const apiResponse = await apiRouter.handle(context);
        if (apiResponse) {
          apiResponse.send(response);
          return;
        }

        if (trySendPublicIndex(response, context.path, publicRoot)) {
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
