export type MiddlewareContext = {
  req: unknown
  res: unknown
  runtime: unknown
  params?: Record<string, string>
  state: Record<string, unknown>
}

export type Middleware =
  (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;
