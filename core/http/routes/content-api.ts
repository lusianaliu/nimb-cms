import { jsonResponse } from '../response.ts';

const mapEntry = (entry) => ({
  id: entry.id,
  type: entry.type,
  fields: { ...(entry.data ?? {}) },
  createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
  updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : entry.updatedAt
});

const resolveTypeError = (error, type) => {
  if (error instanceof Error && error.message === `Unknown content type: ${type}`) {
    return jsonResponse({
      error: {
        code: 'NOT_FOUND',
        message: `Content type not found: ${type}`
      }
    }, { statusCode: 404 });
  }

  throw error;
};

export const registerContentApiRoutes = (router, runtime) => {
  router.register({
    method: 'GET',
    path: '/api/content/:type',
    handler: (context) => {
      const type = context.params?.type ?? '';

      try {
        const entries = runtime.contentStore.list(type).map((entry) => mapEntry(entry));
        return jsonResponse({ entries }, { statusCode: 200 });
      } catch (error) {
        return resolveTypeError(error, type);
      }
    }
  });

  router.register({
    method: 'GET',
    path: '/api/content/:type/:id',
    handler: (context) => {
      const type = context.params?.type ?? '';
      const id = context.params?.id ?? '';

      try {
        const entry = runtime.contentStore.get(type, id);

        if (!entry) {
          return jsonResponse({
            error: {
              code: 'NOT_FOUND',
              message: `Entry not found: ${type}/${id}`
            }
          }, { statusCode: 404 });
        }

        return jsonResponse(mapEntry(entry), { statusCode: 200 });
      } catch (error) {
        return resolveTypeError(error, type);
      }
    }
  });
};
