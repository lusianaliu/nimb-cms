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
import { installGuardMiddleware } from './install-guard-middleware.ts';
import { handleInstall } from '../installer/install-controller.ts';
import { renderInstallPage } from '../installer/install-page.ts';
import { createInstallRouter } from '../install/install-router.ts';
import { createSiteRouter } from './site-router.ts';
import { createAdminRouter } from './admin-router.ts';
import { createAdminApiRouter } from './admin-api-router.ts';
import { createAdminContentRouter } from './admin-content-router.ts';
import { createAdminMediaRouter } from './admin-media-router.ts';
import { createAdminAuthRouter } from './admin-auth-router.ts';

const resolvePublicRoot = ({ runtime, rootDirectory }) => {
  const projectRoot = runtime?.projectPaths?.projectRoot ?? runtime?.project?.projectRoot;
  const publicDir = runtime?.projectPaths?.publicDir ?? runtime?.project?.publicDir;

  if (typeof publicDir === 'string' && publicDir.trim() !== '') {
    return publicDir;
  }

  const baseRoot = typeof projectRoot === 'string' && projectRoot.trim() !== '' ? projectRoot : rootDirectory;
  return path.resolve(baseRoot, 'public');
};

const trySendUploadsAsset = (response, requestPath, uploadsRoot) => {
  if (!requestPath.startsWith('/uploads/')) {
    return false;
  }

  const relativePath = requestPath.replace(/^\/+uploads\//, '');
  const absolutePath = path.resolve(uploadsRoot, relativePath);

  if (absolutePath !== uploadsRoot && !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return false;
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return false;
  }

  const body = fs.readFileSync(absolutePath);
  response.writeHead(200, {
    'content-length': body.byteLength,
    'content-type': 'application/octet-stream'
  });
  response.end(body);
  return true;
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
    ? createAdminRouter({ rootDirectory, runtime })
    : null;
  const adminApiRouter = !installMode && runtime?.mode === 'runtime'
    ? createAdminApiRouter(runtime)
    : null;
  const adminAuthRouter = !installMode && runtime?.mode === 'runtime'
    ? createAdminAuthRouter(runtime)
    : null;
  const adminContentRouter = !installMode && runtime?.mode === 'runtime'
    ? createAdminContentRouter(runtime)
    : null;
  const adminMediaRouter = !installMode && runtime?.mode === 'runtime'
    ? createAdminMediaRouter(runtime)
    : null;
  const router = installMode ? installRouter : runtimeRouter;
  const apiRouter = installMode
    ? { handle: async () => null }
    : createApiRouter({ runtime, authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries });
  const guardRequest = installGuardMiddleware(runtime);
  const publicRoot = resolvePublicRoot({ runtime, rootDirectory });
  const uploadsRoot = '/data/uploads';

  const server = http.createServer((request, response) => {
    const context = createRequestContext(request, { clock });

    Promise.resolve()
      .then(async () => {
        const routeContext = { ...context, response };
        if (!installMode) {
          const guardResponse = await guardRequest(context, () => null);
          if (guardResponse) {
            guardResponse.send(response);
            return;
          }
        }

        if (!installMode && context.path === '/install') {
          if (context.method === 'GET') {
            if (runtime?.system?.installed === true && runtime?.getRuntimeMode?.() !== 'installer') {
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
            (await handleInstall(routeContext.request, runtime)).send(response);
            return;
          }
        }


        if (adminAuthRouter) {
          const adminAuthHandler = adminAuthRouter.dispatch(routeContext);
          if (adminAuthHandler) {
            const adminAuthResponse = await Promise.resolve(adminAuthHandler(routeContext));
            adminAuthResponse.send(response);
            return;
          }
        }

        if (adminContentRouter) {
          const adminContentHandler = adminContentRouter.dispatch(routeContext);
          if (adminContentHandler) {
            const adminContentResponse = await Promise.resolve(adminContentHandler(routeContext));
            adminContentResponse.send(response);
            return;
          }
        }

        if (adminMediaRouter) {
          const adminMediaHandler = adminMediaRouter.dispatch(routeContext);
          if (adminMediaHandler) {
            const adminMediaResponse = await Promise.resolve(adminMediaHandler(routeContext));
            adminMediaResponse.send(response);
            return;
          }
        }

        if (adminRouter) {
          const adminHandler = adminRouter.dispatch(routeContext);
          if (adminHandler) {
            const adminResponse = await Promise.resolve(adminHandler(routeContext));
            adminResponse.send(response);
            return;
          }
        }

        if (adminApiRouter) {
          const adminApiHandler = adminApiRouter.dispatch(routeContext);
          if (adminApiHandler) {
            const adminApiResponse = await Promise.resolve(adminApiHandler(routeContext));
            adminApiResponse.send(response);
            return;
          }
        }

        if (siteRouter) {
          const siteHandler = siteRouter.dispatch(routeContext);
          if (siteHandler) {
            const siteResponse = await Promise.resolve(siteHandler(routeContext));
            siteResponse.send(response);
            return;
          }
        }

        const apiResponse = await apiRouter.handle(routeContext);
        if (apiResponse) {
          apiResponse.send(response);
          return;
        }

        if (trySendUploadsAsset(response, context.path, uploadsRoot)) {
          return;
        }

        if (trySendPublicIndex(response, context.path, publicRoot)) {
          return;
        }

        const handler = router.dispatch(routeContext);

        if (!handler) {
          notFoundResponse({ path: context.path, timestamp: context.timestamp }).send(response);
          return;
        }

        const routeResponse = await Promise.resolve(handler(routeContext));
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

  const listen = (targetPort = port) => new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(new Error(`Failed to start HTTP server on port ${targetPort}: ${error?.message ?? 'unknown error'}`));
    };

    const onListening = () => {
      server.off('error', onError);
      const address = server.address();
      const activePort = typeof address === 'object' && address ? address.port : targetPort;

      if (runtime?.getRuntimeMode?.() === 'installer') {
        process.stdout.write('installer HTTP gate: active\n');
      }

      resolve({ port: activePort });
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(targetPort);
  });

  const close = () => new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });

  return Object.freeze({
    port,
    server,
    listen,
    close,
    start() {
      return listen(port);
    },
    stop() {
      return close();
    }
  });
};
