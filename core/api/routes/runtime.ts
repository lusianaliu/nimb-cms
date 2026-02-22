import { createApiController, createApiResponse } from '../api-controller.ts';

export const createRuntimeApiRoute = () => ({
  method: 'GET',
  path: '/api/runtime',
  controller: createApiController((_context, runtime) => {
    const inspector = runtime.getInspector();

    return createApiResponse({
      data: {
        runtime: inspector.snapshot()
      }
    });
  })
});
