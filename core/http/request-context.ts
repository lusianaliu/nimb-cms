const normalizePath = (path = '/') => {
  if (!path || path === '') {
    return '/';
  }

  const normalized = path.replace(/\/+/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }

  return normalized;
};

export const createRequestContext = (request, { clock = () => '1970-01-01T00:00:00.000Z' } = {}) => {
  const host = request.headers.host ?? 'localhost';
  const requestUrl = new URL(request.url ?? '/', `http://${host}`);

  return Object.freeze({
    method: (request.method ?? 'GET').toUpperCase(),
    path: normalizePath(requestUrl.pathname),
    query: Object.freeze(Object.fromEntries(requestUrl.searchParams.entries())),
    timestamp: clock(),
    request
  });
};
