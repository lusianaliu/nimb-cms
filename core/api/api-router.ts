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

export const createApiRouter = ({ runtime }: { runtime: { getInspector: () => unknown } }) => {
  const router = createRouter(defaultRoutes().map((route) => ({
    method: route.method,
    path: route.path,
    handler: (context: { method: string, path: string, timestamp: string }) => route.controller(context, runtime)
  })));

  return Object.freeze({
    handle(context: { method: string, path: string, timestamp: string }) {
      if (!context.path.startsWith('/api')) {
        return null;
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
