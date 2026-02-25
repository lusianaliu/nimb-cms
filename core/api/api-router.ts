import { jsonResponse } from '../http/response.ts';
import { createApiError } from './api-error.ts';
import { createGoalsApiRoute } from './routes/goals.ts';
import { createPersistenceApiRoute } from './routes/persistence.ts';
import { createRuntimeApiRoute } from './routes/runtime.ts';
import { createSystemApiRoute } from './routes/system.ts';
import { createAdminRouter } from '../admin/index.ts';

const defaultRoutes = () => [
  createSystemApiRoute(),
  createRuntimeApiRoute(),
  createGoalsApiRoute(),
  createPersistenceApiRoute()
];

const readJsonBody = async (request: { method?: string, headers: Record<string, string | string[] | undefined>, [Symbol.asyncIterator]: () => AsyncIterableIterator<Buffer> }) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes((request.method ?? 'GET').toUpperCase())) {
    return Object.freeze({});
  }

  const contentType = request.headers['content-type'] ?? '';
  if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
    return Object.freeze({});
  }

  let raw = '';
  for await (const chunk of request) {
    raw += chunk.toString('utf8');
  }

  if (raw.trim() === '') {
    return Object.freeze({});
  }

  return JSON.parse(raw);
};

export const createApiRouter = ({ runtime, authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries }: { runtime: { getInspector: () => unknown }, authService?: { login: (input: { username: string, password: string }) => Promise<unknown>, logout: (token: string) => Promise<boolean>, getSession: (token: string) => unknown }, authMiddleware?: { attach: (context: { request: { headers: Record<string, string | string[] | undefined> } }) => { token: string | null, authenticated: boolean, session: unknown } }, adminController?: { restartRuntime: (input: { requestId: string, payload: unknown }) => Promise<unknown>, persistRuntime: (input: { requestId: string, payload: unknown }) => Promise<unknown>, reconcileGoals: (input: { requestId: string, payload: unknown }) => Promise<unknown>, status: () => unknown }, contentRegistry?: { register: (schema: unknown, options?: { source?: string }) => unknown, list: () => unknown[], get: (name: string) => unknown } , persistContentTypes?: () => Promise<unknown>, entryRegistry?: { create: (type: string, data: unknown, options?: { source?: string, timestamp?: string }) => unknown, list: (type: string) => unknown[], query: (type: string, options?: { state?: string, limit?: string, offset?: string, sort?: string, order?: string }) => unknown[], get: (type: string, id: string) => unknown, publish: (type: string, id: string, options?: { source?: string, timestamp?: string }) => unknown, archive: (type: string, id: string, options?: { source?: string, timestamp?: string }) => unknown, draft: (type: string, id: string, options?: { source?: string, timestamp?: string }) => unknown }, persistEntries?: () => Promise<unknown> }) => {
  const routes = defaultRoutes();
  const adminRouter = adminController
    ? createAdminRouter({ controller: adminController, authMiddleware })
    : null;

  return Object.freeze({
    async handle(context: { method: string, path: string, query?: Record<string, string>, timestamp: string, request: { headers: Record<string, string | string[] | undefined>, method?: string, [Symbol.asyncIterator]: () => AsyncIterableIterator<Buffer> } }) {
      if (!context.path.startsWith('/api')) {
        return null;
      }

      if (context.path.startsWith('/api/content/')) {
        return null;
      }

      if (context.path === '/api/auth/login' && context.method === 'POST' && authService) {
        try {
          const body = await readJsonBody(context.request);
          const username = typeof body?.username === 'string' ? body.username : '';
          const password = typeof body?.password === 'string' ? body.password : '';
          const session = await authService.login({ username, password });

          if (!session) {
            return jsonResponse(createApiError({ code: 'INVALID_REQUEST', message: 'Invalid credentials' }), { statusCode: 401 });
          }

          return jsonResponse({ success: true, data: { session }, meta: {} }, { statusCode: 200 });
        } catch {
          return jsonResponse(createApiError({ code: 'INVALID_REQUEST', message: 'Invalid login payload' }), { statusCode: 400 });
        }
      }

      if (context.path === '/api/auth/logout' && context.method === 'POST' && authService && authMiddleware) {
        const auth = authMiddleware.attach(context);
        if (!auth.authenticated || !auth.token) {
          return jsonResponse(createApiError({ code: 'INVALID_REQUEST', message: 'Invalid token' }), { statusCode: 401 });
        }

        await authService.logout(auth.token);
        return jsonResponse({ success: true, data: { loggedOut: true }, meta: {} }, { statusCode: 200 });
      }

      if (context.path === '/api/auth/session' && context.method === 'GET' && authMiddleware) {
        const auth = authMiddleware.attach(context);

        if (!auth.authenticated) {
          return jsonResponse(createApiError({ code: 'INVALID_REQUEST', message: 'Invalid token' }), { statusCode: 401 });
        }

        return jsonResponse({ success: true, data: { session: auth.session }, meta: {} }, { statusCode: 200 });
      }


      if (context.path === '/api/content-types' && context.method === 'GET' && contentRegistry) {
        return jsonResponse({ success: true, data: { contentTypes: contentRegistry.list() }, meta: {} }, { statusCode: 200 });
      }

      if (context.path.startsWith('/api/content-types/') && context.method === 'GET' && contentRegistry) {
        const name = decodeURIComponent(context.path.slice('/api/content-types/'.length));
        const schema = contentRegistry.get(name);
        if (!schema) {
          return jsonResponse(createApiError({ code: 'NOT_FOUND', message: `Content type not found: ${name}` }), { statusCode: 404 });
        }

        return jsonResponse({ success: true, data: { contentType: schema }, meta: {} }, { statusCode: 200 });
      }

      if (context.path.startsWith('/api/entries/') && context.method === 'GET' && entryRegistry) {
        const parts = context.path.split('/').filter(Boolean);

        if (parts.length === 3) {
          const type = decodeURIComponent(parts[2]);
          const entries = entryRegistry.query(type, {
            state: context.query?.state,
            limit: context.query?.limit,
            offset: context.query?.offset,
            sort: context.query?.sort,
            order: context.query?.order
          });

          return jsonResponse({
            success: true,
            data: { entries },
            meta: {
              query: {
                state: context.query?.state ?? null,
                limit: context.query?.limit ?? null,
                offset: context.query?.offset ?? null,
                sort: context.query?.sort ?? null,
                order: context.query?.order ?? null
              }
            }
          }, { statusCode: 200 });
        }

        if (parts.length === 4) {
          const type = decodeURIComponent(parts[2]);
          const id = decodeURIComponent(parts[3]);
          const entry = entryRegistry.get(type, id);

          if (!entry) {
            return jsonResponse(createApiError({ code: 'NOT_FOUND', message: `Entry not found: ${type}/${id}` }), { statusCode: 404 });
          }

          return jsonResponse({ success: true, data: { entry }, meta: {} }, { statusCode: 200 });
        }
      }

      const requestBody = await readJsonBody(context.request);


      if (context.path === '/api/admin/content-types' && context.method === 'POST' && contentRegistry && authMiddleware) {
        const auth = authMiddleware.attach(context);
        if (!auth.authenticated) {
          return jsonResponse(createApiError({ code: 'INVALID_REQUEST', message: 'Invalid token' }), { statusCode: 401 });
        }

        try {
          const schema = contentRegistry.register(requestBody, { source: 'admin.command' });
          await persistContentTypes?.();
          return jsonResponse({ success: true, data: { contentType: schema }, meta: {} }, { statusCode: 200 });
        } catch (error) {
          return jsonResponse(createApiError({ code: 'INVALID_REQUEST', message: error instanceof Error ? error.message : 'Invalid schema' }), { statusCode: 400 });
        }
      }


      if (context.path.startsWith('/api/admin/entries/') && context.method === 'POST' && entryRegistry && authMiddleware) {
        const auth = authMiddleware.attach(context);
        if (!auth.authenticated) {
          return jsonResponse(createApiError({ code: 'INVALID_REQUEST', message: 'Invalid token' }), { statusCode: 401 });
        }

        const lifecycleMatch = context.path.match(/^\/api\/admin\/entries\/([^/]+)\/([^/]+)\/(publish|archive|draft)$/);
        if (lifecycleMatch) {
          const type = decodeURIComponent(lifecycleMatch[1]);
          const id = decodeURIComponent(lifecycleMatch[2]);
          const transition = lifecycleMatch[3];

          try {
            const entry = transition === 'publish'
              ? entryRegistry.publish(type, id, { source: 'admin.command', timestamp: context.timestamp })
              : transition === 'archive'
                ? entryRegistry.archive(type, id, { source: 'admin.command', timestamp: context.timestamp })
                : entryRegistry.draft(type, id, { source: 'admin.command', timestamp: context.timestamp });
            await persistEntries?.();
            return jsonResponse({ success: true, data: { entry }, meta: {} }, { statusCode: 200 });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid entry transition';
            const statusCode = message.startsWith('Entry not found:') ? 404 : 400;
            const code = statusCode === 404 ? 'NOT_FOUND' : 'INVALID_REQUEST';
            return jsonResponse(createApiError({ code, message }), { statusCode });
          }
        }

        const type = decodeURIComponent(context.path.slice('/api/admin/entries/'.length));

        try {
          const entry = entryRegistry.create(type, requestBody, { source: 'admin.command', timestamp: context.timestamp });
          await persistEntries?.();
          return jsonResponse({ success: true, data: { entry }, meta: {} }, { statusCode: 200 });
        } catch (error) {
          return jsonResponse(createApiError({ code: 'INVALID_REQUEST', message: error instanceof Error ? error.message : 'Invalid entry payload' }), { statusCode: 400 });
        }
      }

      if (adminRouter) {
        const adminPayload = await adminRouter.handle(context, requestBody);
        if (adminPayload) {
          const statusCode = adminPayload.success
            ? 200
            : adminPayload.error?.code === 'INVALID_REQUEST'
              ? 401
              : adminPayload.error?.code === 'NOT_FOUND'
                ? 404
                : 500;
          return jsonResponse(adminPayload, { statusCode });
        }
      }

      const route = routes.find((entry) => entry.method === context.method && entry.path === context.path);
      if (!route) {
        return jsonResponse(createApiError({
          code: 'NOT_FOUND',
          message: `API route not found: ${context.path}`
        }), { statusCode: 404 });
      }

      const payload = route.controller(context, runtime);
      const statusCode = payload.success ? 200 : 500;
      return jsonResponse(payload, { statusCode });
    }
  });
};
