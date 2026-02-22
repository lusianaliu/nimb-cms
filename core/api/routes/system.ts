import { createApiController, createApiResponse } from '../api-controller.ts';

export const createSystemApiRoute = () => ({
  method: 'GET',
  path: '/api/system',
  controller: createApiController((_context, runtime) => {
    const inspector = runtime.getInspector();

    return createApiResponse({
      data: {
        system: inspector.bootstrap()
      }
    });
  })
});
