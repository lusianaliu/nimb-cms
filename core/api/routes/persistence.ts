import { createApiController, createApiResponse } from '../api-controller.ts';

export const createPersistenceApiRoute = () => ({
  method: 'GET',
  path: '/api/persistence',
  controller: createApiController((_context, runtime) => {
    const inspector = runtime.getInspector();

    return createApiResponse({
      data: {
        persistence: inspector.persistence()
      }
    });
  })
});
