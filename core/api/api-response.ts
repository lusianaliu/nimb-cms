export type ApiSuccessResponse = Readonly<{
  success: true,
  data: Readonly<Record<string, unknown>>,
  meta: Readonly<Record<string, unknown>>
}>;

export const createApiResponse = ({ data = {}, meta = {} }: {
  data?: Record<string, unknown>,
  meta?: Record<string, unknown>
} = {}): ApiSuccessResponse => Object.freeze({
  success: true,
  data: Object.freeze({ ...data }),
  meta: Object.freeze({ ...meta })
});
