import { jsonResponse, noContentResponse } from '../response.ts';

const readJsonBody = async (request) => {
  const contentType = request?.headers?.['content-type'] ?? '';
  if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
    throw new Error('Request body must be JSON');
  }

  let raw = '';
  for await (const chunk of request) {
    raw += chunk.toString('utf8');
  }

  if (raw.trim() === '') {
    return {};
  }

  return JSON.parse(raw);
};

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

const parseFieldsPayload = async (request) => {
  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    return {
      error: jsonResponse({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid JSON body'
        }
      }, { statusCode: 400 })
    };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !('fields' in payload) || typeof payload.fields !== 'object' || payload.fields === null || Array.isArray(payload.fields)) {
    return {
      error: jsonResponse({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body must include a "fields" object'
        }
      }, { statusCode: 400 })
    };
  }

  return { fields: payload.fields };
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
    method: 'POST',
    path: '/api/content/:type',
    handler: async (context) => {
      const type = context.params?.type ?? '';

      if (!runtime.contentTypes.get(type)) {
        return jsonResponse({
          error: {
            code: 'NOT_FOUND',
            message: `Content type not found: ${type}`
          }
        }, { statusCode: 404 });
      }

      const parsed = await parseFieldsPayload(context.request);
      if (parsed.error) {
        return parsed.error;
      }

      try {
        const entry = runtime.contentStore.create(type, parsed.fields);
        await runtime.persistContentSnapshot?.();
        return jsonResponse(mapEntry(entry), { statusCode: 201 });
      } catch (error) {
        return jsonResponse({
          error: {
            code: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'Invalid content entry'
          }
        }, { statusCode: 400 });
      }
    }
  });

  router.register({
    method: 'PATCH',
    path: '/api/content/:type/:id',
    handler: async (context) => {
      const type = context.params?.type ?? '';
      const id = context.params?.id ?? '';

      if (!runtime.contentTypes.get(type)) {
        return jsonResponse({
          error: {
            code: 'NOT_FOUND',
            message: `Content type not found: ${type}`
          }
        }, { statusCode: 404 });
      }

      const parsed = await parseFieldsPayload(context.request);
      if (parsed.error) {
        return parsed.error;
      }

      try {
        const updated = runtime.contentStore.update(type, id, parsed.fields);
        await runtime.persistContentSnapshot?.();
        return jsonResponse(mapEntry(updated), { statusCode: 200 });
      } catch (error) {
        if (error instanceof Error && error.message === `Entry not found: ${type}/${id}`) {
          return jsonResponse({
            error: {
              code: 'NOT_FOUND',
              message: `Entry not found: ${type}/${id}`
            }
          }, { statusCode: 404 });
        }

        return jsonResponse({
          error: {
            code: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'Invalid content entry'
          }
        }, { statusCode: 400 });
      }
    }
  });


  router.register({
    method: 'DELETE',
    path: '/api/content/:type/:id',
    handler: async (context) => {
      const type = context.params?.type ?? '';
      const id = context.params?.id ?? '';

      if (!runtime.contentTypes.get(type)) {
        return jsonResponse({
          error: {
            code: 'NOT_FOUND',
            message: `Content type not found: ${type}`
          }
        }, { statusCode: 404 });
      }

      try {
        runtime.contentStore.delete(type, id);
        await runtime.persistContentSnapshot?.();
        return noContentResponse();
      } catch (error) {
        if (error instanceof Error && error.message === `Entry not found: ${type}/${id}`) {
          return jsonResponse({
            error: {
              code: 'NOT_FOUND',
              message: `Entry not found: ${type}/${id}`
            }
          }, { statusCode: 404 });
        }

        throw error;
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
