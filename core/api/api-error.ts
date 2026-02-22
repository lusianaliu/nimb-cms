export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'API_CONTROLLER_FAILURE'
  | 'INVALID_REQUEST';

export type ApiErrorResponse = Readonly<{
  success: false,
  error: Readonly<{
    code: string,
    message: string
  }>
}>;

export const createApiError = ({ code, message }: { code: ApiErrorCode | string, message: string }): ApiErrorResponse => Object.freeze({
  success: false,
  error: Object.freeze({
    code,
    message
  })
});
