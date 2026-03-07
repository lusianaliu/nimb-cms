import fs from 'node:fs';
import path from 'node:path';
import { createRequestContext } from '../http/request-context.ts';
import { createRouter } from '../http/router.ts';
import { createHealthRoute } from '../http/routes/health.ts';
import { createRuntimeRoute } from '../http/routes/runtime.ts';
import { createInspectorRoute } from '../http/routes/inspector.ts';
import { registerContentApiRoutes } from '../http/routes/content-api.ts';
import { createApiRouter } from '../api/index.ts';
import { errorResponse, jsonResponse, notFoundResponse, redirectResponse } from '../http/response.ts';
import { installGuardMiddleware } from '../http/install-guard-middleware.ts';
import { handleInstall } from '../installer/install-controller.ts';
import { renderInstallPage } from '../installer/install-page.ts';
import { createInstallRouter } from '../install/install-router.ts';
import { createSiteRouter } from '../http/site-router.ts';
import { createAdminRouter } from '../http/admin-router.ts';
import { createAdminApiRouter } from '../http/admin-api-router.ts';
import { createAdminContentRouter } from '../http/admin-content-router.ts';
import { createAdminAuthRouter } from '../http/admin-auth-router.ts';
import { ADMIN_SESSION_COOKIE, setCookie } from '../http/cookies.ts';
import { createMediaController } from '../http/media-controller.ts';

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

export const createRequestHandler = (runtime, {
  config,
  startupTimestamp = new Date().toISOString(),
  rootDirectory = process.cwd(),
  clock = () => new Date().toISOString(),
  authService = runtime?.authService,
  authMiddleware = runtime?.authMiddleware,
  adminController = runtime?.adminController,
  contentRegistry = runtime?.contentRegistry,
  persistContentTypes = runtime?.persistContentTypes,
  entryRegistry = runtime?.entryRegistry,
  persistEntries = runtime?.persistEntries
} = {}) => {
  const installMode = runtime?.mode === 'install';
  const resolvedConfig = config ?? runtime?.getConfig?.() ?? Object.freeze({});

  const runtimeRouter = createRouter([
    createHealthRoute({ config: resolvedConfig }),
    createRuntimeRoute({ config: resolvedConfig, runtime, startupTimestamp, clock }),
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
  const adminApiRouter = !installMode && runtime?.mode === 'runtime' ? createAdminApiRouter(runtime) : null;
  const adminAuthRouter = !installMode && runtime?.mode === 'runtime' ? createAdminAuthRouter(runtime) : null;
  const adminContentRouter = !installMode && runtime?.mode === 'runtime' ? createAdminContentRouter(runtime) : null;
  const mediaController = !installMode && runtime?.mode === 'runtime' ? createMediaController({ rootDirectory }) : null;
  const router = installMode ? installRouter : runtimeRouter;
  const apiRouter = installMode
    ? { handle: async () => null }
    : createApiRouter({ runtime, authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries });
  const guardRequest = installGuardMiddleware(runtime);
  const publicRoot = resolvePublicRoot({ runtime, rootDirectory });
  const uploadsRoot = '/data/uploads';

  return async (request, response) => {
    const context = createRequestContext(request, { clock });

    try {
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
          if (runtime?.system?.installed === true) {
            redirectResponse('/admin').send(response);
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
          const installResult = await handleInstall(routeContext.request, runtime);

          if (installResult?.success === true) {
            if (installResult?.data?.session?.id) {
              setCookie(response, ADMIN_SESSION_COOKIE, installResult.data.session.id);
            }

            response.writeHead(302, { location: '/admin/setup', 'content-length': '0' });
            response.end();
            return;
          }

          jsonResponse(installResult, { statusCode: installResult?.error?.code === 'ALREADY_INSTALLED' ? 409 : 500 }).send(response);
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

      if (mediaController) {
        const mediaHandler = mediaController.dispatch(routeContext);
        if (mediaHandler) {
          const mediaResponse = await Promise.resolve(mediaHandler(routeContext));
          mediaResponse.send(response);
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

      if (mediaController && await mediaController.tryServeMediaAsset(response, context.path)) {
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
    } catch (error) {
      errorResponse({
        code: 'HTTP_ROUTE_FAILURE',
        message: error?.message ?? 'Route execution failed',
        timestamp: context.timestamp
      }).send(response);
    }
  };
};
