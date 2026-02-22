import { createApiError } from '../api/api-controller.ts';

const createUnauthorized = () => createApiError({
  code: 'INVALID_REQUEST',
  message: 'Invalid token'
});

const extractRequestId = (context) => {
  const header = context.request.headers['x-request-id'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }

  return `${context.method}:${context.path}:${context.timestamp}`;
};

export const createAdminRouter = ({ controller, authMiddleware }) => ({
  async handle(context, body = Object.freeze({})) {
    if (!context.path.startsWith('/api/admin')) {
      return null;
    }

    const auth = authMiddleware?.attach?.(context);
    if (!auth?.authenticated) {
      return createUnauthorized();
    }

    const payload = {
      requestId: extractRequestId(context),
      payload: body
    };

    if (context.path === '/api/admin/runtime/restart' && context.method === 'POST') {
      return controller.restartRuntime(payload);
    }

    if (context.path === '/api/admin/runtime/persist' && context.method === 'POST') {
      return controller.persistRuntime(payload);
    }

    if (context.path === '/api/admin/goals/reconcile' && context.method === 'POST') {
      return controller.reconcileGoals(payload);
    }

    if (context.path === '/api/admin/status' && context.method === 'GET') {
      return controller.status();
    }

    return createApiError({ code: 'NOT_FOUND', message: `API route not found: ${context.path}` });
  }
});
