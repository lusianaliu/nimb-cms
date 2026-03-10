import fs from 'node:fs';
import path from 'node:path';
import { createRequestContext } from '../http/request-context.ts';
import { createRouter } from '../http/router.ts';
import { createHealthRoute } from '../http/routes/health.ts';
import { createRuntimeRoute } from '../http/routes/runtime.ts';
import { createInspectorRoute } from '../http/routes/inspector.ts';
import { registerContentApiRoutes } from '../http/routes/content-api.ts';
import { createApiRouter } from '../api/index.ts';
import { errorResponse, jsonResponse, notFoundResponse } from '../http/response.ts';
import { installGuardMiddleware } from '../http/install-guard-middleware.ts';
import { handleInstall } from '../installer/install-controller.ts';
import { renderInstallPage } from '../installer/install-page.ts';
import { createSiteRouter } from '../http/site-router.ts';
import { createAdminRouter } from '../http/admin-router.ts';
import { createAdminApiRouter } from '../http/admin-api-router.ts';
import { createAdminContentRouter } from '../http/admin-content-router.ts';
import { createAdminAuthRouter } from '../http/admin-auth-router.ts';
import { createMediaController } from '../http/media-controller.ts';
import { isSystemInstalled } from '../system/system-config.ts';
import { renderAdminLayout } from '../admin/admin-layout.ts';

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


const readFormBody = async (request) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
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

const trySendPublicAsset = (response, requestPath, publicRoot) => {
  if (!requestPath.startsWith('/assets/')) {
    return false;
  }

  const relativePath = requestPath.replace(/^\/+assets\//, 'assets/');
  const absolutePath = path.resolve(publicRoot, relativePath);

  if (absolutePath !== publicRoot && !absolutePath.startsWith(`${publicRoot}${path.sep}`)) {
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
  const resolvedConfig = config ?? runtime?.getConfig?.() ?? Object.freeze({});

  const runtimeRouter = createRouter([
    createHealthRoute({ config: resolvedConfig }),
    createRuntimeRoute({ config: resolvedConfig, runtime, startupTimestamp, clock }),
    createInspectorRoute({ runtime })
  ]);

  registerContentApiRoutes(runtimeRouter, runtime);

  const siteRouter = createSiteRouter(runtime);
  const adminRouter = createAdminRouter({ rootDirectory, runtime });
  const adminApiRouter = createAdminApiRouter(runtime);
  const adminAuthRouter = createAdminAuthRouter(runtime);
  const adminContentRouter = createAdminContentRouter(runtime);
  const mediaController = createMediaController({ rootDirectory });
  const pluginRouter = runtime?.pluginRouter;
  const router = runtimeRouter;
  const apiRouter = createApiRouter({ runtime, authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries });
  const guardRequest = installGuardMiddleware(runtime);
  const publicRoot = resolvePublicRoot({ runtime, rootDirectory });
  const uploadsRoot = '/data/uploads';

  return async (request, response) => {
    const context = createRequestContext(request, { clock });

    try {
      const routeContext = { ...context, response };
      const guardResponse = await guardRequest(context, () => null);
      if (guardResponse) {
        guardResponse.send(response);
        return;
      }

      if (context.path === '/install') {
        const projectRoot = runtime?.projectPaths?.projectRoot ?? runtime?.project?.projectRoot;

        if (isSystemInstalled({ projectRoot })) {
          response.writeHead(302, { location: '/admin/login?install=complete', 'content-length': '0' });
          response.end();
          return;
        }

        if (context.method === 'GET') {
          const body = Buffer.from(renderInstallPage(), 'utf8');
          response.writeHead(200, {
            'content-length': body.byteLength,
            'content-type': 'text/html; charset=utf-8'
          });
          response.end(body);
          return;
        }

        if (context.method === 'POST') {
          const form = await readFormBody(routeContext.request);
          const installResult = await handleInstall(routeContext.request, runtime, {
            siteTitle: `${form.siteTitle ?? ''}`,
            adminUser: `${form.adminUser ?? ''}`,
            adminPassword: `${form.adminPassword ?? ''}`,
            adminPasswordConfirm: `${form.adminPasswordConfirm ?? ''}`
          });

          if (installResult?.success === true) {
            response.writeHead(302, { location: '/admin/login?welcome=1', 'content-length': '0' });
            response.end();
            return;
          }

          if (installResult?.error?.code === 'INVALID_INSTALL_INPUT') {
            const body = Buffer.from(renderInstallPage({
              error: installResult.error.message,
              values: {
                siteTitle: `${form.siteTitle ?? ''}`,
                adminUser: `${form.adminUser ?? ''}`
              }
            }), 'utf8');
            response.writeHead(400, {
              'content-length': body.byteLength,
              'content-type': 'text/html; charset=utf-8'
            });
            response.end(body);
            return;
          }

          if (installResult?.error?.code === 'ALREADY_INSTALLED') {
            response.writeHead(302, { location: '/admin/login?install=complete', 'content-length': '0' });
            response.end();
            return;
          }

          if (installResult?.error?.code === 'INSTALL_PERSIST_FAILED' || installResult?.error?.code === 'INSTALL_PATH_UNAVAILABLE') {
            const body = Buffer.from(renderInstallPage({
              error: installResult.error.message,
              values: {
                siteTitle: `${form.siteTitle ?? ''}`,
                adminUser: `${form.adminUser ?? ''}`
              }
            }), 'utf8');
            response.writeHead(500, {
              'content-length': body.byteLength,
              'content-type': 'text/html; charset=utf-8'
            });
            response.end(body);
            return;
          }

          jsonResponse(installResult, { statusCode: installResult?.error?.code === 'ALREADY_INSTALLED' ? 409 : 500 }).send(response);
          return;
        }
      }

      if (context.path.startsWith('/admin')) {
        const page = runtime?.adminPages?.get?.(context.path);

        if (page) {
          const content = await Promise.resolve(page.render(routeContext.request, response, runtime));
          const menu = runtime?.adminMenu?.list?.() ?? [];
          const html = renderAdminLayout({
            title: page.title,
            content: `${content ?? ''}`,
            menu
          });
          const body = Buffer.from(`${html ?? ''}`, 'utf8');
          response.writeHead(200, {
            'content-length': body.byteLength,
            'content-type': 'text/html; charset=utf-8'
          });
          response.end(body);
          return;
        }

        if (context.path === '/admin' || context.path.startsWith('/admin/')) {
          notFoundResponse({ path: context.path, timestamp: context.timestamp }).send(response);
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

      if (pluginRouter) {
        const pluginHandler = pluginRouter.dispatch(routeContext);
        if (pluginHandler) {
          try {
            const pluginResponse = await Promise.resolve(pluginHandler(routeContext));
            if (pluginResponse && typeof pluginResponse.send === 'function') {
              pluginResponse.send(response);
            } else if (!response.writableEnded) {
              response.writeHead(204, { 'content-length': '0' });
              response.end();
            }
            return;
          } catch (error) {
            errorResponse({
              code: 'PLUGIN_ROUTE_FAILURE',
              message: error?.message ?? 'Plugin route execution failed',
              timestamp: context.timestamp
            }).send(response);
            return;
          }
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

      if (trySendPublicAsset(response, context.path, publicRoot)) {
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
