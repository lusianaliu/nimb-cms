const routeKey = (method, path) => `${method} ${path}`;

const toPathMatcher = (path) => {
  if (!path.includes(':')) {
    return null;
  }

  const segments = path.split('/').filter(Boolean);

  return (requestPath) => {
    const requestSegments = requestPath.split('/').filter(Boolean);
    if (segments.length !== requestSegments.length) {
      return null;
    }

    const params = {};

    for (let index = 0; index < segments.length; index += 1) {
      const routeSegment = segments[index];
      const requestSegment = requestSegments[index];

      if (routeSegment.startsWith(':')) {
        params[routeSegment.slice(1)] = decodeURIComponent(requestSegment);
        continue;
      }

      if (routeSegment !== requestSegment) {
        return null;
      }
    }

    return params;
  };
};

export const createRouter = (routes = []) => {
  const table = new Map();
  const matchers = [];

  const register = (route) => {
    const key = routeKey(route.method, route.path);
    table.set(key, route.handler);

    const matcher = toPathMatcher(route.path);
    if (matcher) {
      matchers.push({ method: route.method, matcher, handler: route.handler });
    }
  };

  for (const route of routes) {
    register(route);
  }

  return Object.freeze({
    register,
    dispatch(context) {
      const exact = table.get(routeKey(context.method, context.path));
      if (exact) {
        return exact;
      }

      for (const entry of matchers) {
        if (entry.method !== context.method) {
          continue;
        }

        const params = entry.matcher(context.path);
        if (!params) {
          continue;
        }

        return (requestContext) => entry.handler({ ...requestContext, params });
      }

      return null;
    }
  });
};
