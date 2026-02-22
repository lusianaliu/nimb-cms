import { createRouter } from '../http/router.ts';
import { jsonResponse } from '../http/response.ts';
import { createApiError } from './api-error.ts';
import { createGoalsApiRoute } from './routes/goals.ts';
import { createPersistenceApiRoute } from './routes/persistence.ts';
import { createRuntimeApiRoute } from './routes/runtime.ts';
import { createSystemApiRoute } from './routes/system.ts';

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

export const createApiRouter = ({ runtime, authService, authMiddleware }: { runtime: { getInspector: () => unknown }, authService?: { login: (input: { username: string, password: string }) => Promise<unknown>, logout: (token: string) => Promise<boolean>, getSession: (token: string) => unknown }, authMiddleware?: { attach: (context: { request: { headers: Record<string, string | string[] | undefined> } }) => { token: string | null, authenticated: boolean, session: unknown } } }) => {
  const router = createRouter(defaultRoutes().map((route) => ({
    method: route.method,
    path: route.path,
    handler: (context: { method: string, path: string, timestamp: string }) => route.controller(context, runtime)
  })));

  return Object.freeze({
    async handle(context: { method: string, path: string, timestamp: string, request: { headers: Record<string, string | string[] | undefined>, method?: string, [Symbol.asyncIterator]: () => AsyncIterableIterator<Buffer> } }) {
      if (!context.path.startsWith('/api')) {
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

      const handler = router.dispatch(context);
      if (!handler) {
        return jsonResponse(createApiError({
          code: 'NOT_FOUND',
          message: `API route not found: ${context.path}`
        }), { statusCode: 404 });
      }

      const payload = handler(context);
      const statusCode = payload.success ? 200 : 500;
      return jsonResponse(payload, { statusCode });
    }
  });
};
