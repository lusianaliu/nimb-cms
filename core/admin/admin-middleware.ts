import type { Middleware } from '../http/middleware.ts';

export const createAdminMiddlewareRegistry = () => {
  const middlewares: Middleware[] = [];

  return Object.freeze({
    use(middleware: Middleware) {
      if (typeof middleware !== 'function') {
        throw new Error('Admin middleware must be a function');
      }

      middlewares.push(middleware);
      return middleware;
    },
    list() {
      return [...middlewares];
    }
  });
};
