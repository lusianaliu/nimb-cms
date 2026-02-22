import { createApiController, createApiResponse } from '../api-controller.ts';

export const createGoalsApiRoute = () => ({
  method: 'GET',
  path: '/api/goals',
  controller: createApiController((_context, runtime) => {
    const inspector = runtime.getInspector();

    return createApiResponse({
      data: {
        goals: inspector.goals()
      }
    });
  })
});
