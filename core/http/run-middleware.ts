import type { Middleware, MiddlewareContext } from './middleware.ts';

export const runMiddlewareStack = async (
  ctx: MiddlewareContext,
  middlewares: Middleware[],
  handler: () => Promise<void>
) => {
  let index = -1;

  const dispatch = async (cursor: number): Promise<void> => {
    if (cursor <= index) {
      throw new Error('next() called multiple times');
    }

    index = cursor;
    const middleware = middlewares[cursor];

    if (!middleware) {
      await handler();
      return;
    }

    await middleware(ctx, async () => {
      await dispatch(cursor + 1);
    });
  };

  await dispatch(0);
};
