const routeKey = (method, path) => `${method} ${path}`;

export const createRouter = (routes = []) => {
  const table = new Map();

  for (const route of routes) {
    table.set(routeKey(route.method, route.path), route.handler);
  }

  return Object.freeze({
    dispatch(context) {
      return table.get(routeKey(context.method, context.path)) ?? null;
    }
  });
};
