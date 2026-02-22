import { createApiError, type ApiErrorResponse } from './api-error.ts';
import { createApiResponse, type ApiSuccessResponse } from './api-response.ts';

export type ApiControllerContext = Readonly<{
  method: string,
  path: string,
  timestamp: string
}>;

export type ApiControllerRuntime = {
  getInspector: () => {
    bootstrap: () => unknown,
    goals: () => unknown,
    persistence: () => unknown,
    snapshot: () => unknown
  }
};

export type ApiControllerResult = ApiSuccessResponse | ApiErrorResponse;

export const createApiController = (
  controller: (context: ApiControllerContext, runtime: ApiControllerRuntime) => ApiControllerResult
) => (context: ApiControllerContext, runtime: ApiControllerRuntime): ApiControllerResult => {
  try {
    return controller(context, runtime);
  } catch (error) {
    return createApiError({
      code: 'API_CONTROLLER_FAILURE',
      message: error instanceof Error ? error.message : 'Controller execution failed'
    });
  }
};

export { createApiResponse, createApiError };
