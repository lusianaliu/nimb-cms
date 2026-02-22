import http from 'node:http';
import { createRequestContext } from './request-context.ts';
import { createRouter } from './router.ts';
import { createHealthRoute } from './routes/health.ts';
import { createRuntimeRoute } from './routes/runtime.ts';
import { createInspectorRoute } from './routes/inspector.ts';
import { createApiRouter } from '../api/index.ts';
import { errorResponse, notFoundResponse } from './response.ts';

export const createHttpServer = ({ runtime, config, startupTimestamp, port = 3000, clock = () => new Date().toISOString(), authService, authMiddleware }) => {
  const router = createRouter([
    createHealthRoute(),
    createRuntimeRoute({ config, runtime, startupTimestamp, clock }),
    createInspectorRoute({ runtime })
  ]);
  const apiRouter = createApiRouter({ runtime, authService, authMiddleware });

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
