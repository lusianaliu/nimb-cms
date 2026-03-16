import { createRouter } from './router.ts';
import { jsonResponse, noContentResponse } from './response.ts';

type PagePayload = {
  title?: unknown,
  slug?: unknown,
  body?: unknown,
  publishedAt?: unknown,
  status?: unknown
};


const hasField = (runtime, type: string, name: string) => {
  const fields = runtime?.content?.getTypeSchema?.(type)?.fields ?? [];
  return fields.some((field) => `${field?.name ?? ''}` === name);
};

const readJsonBody = async (request): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length < 1) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    if (!parsed || Array.isArray(parsed)) {
      throw new Error('INVALID_JSON_OBJECT');
    }

    return parsed;
  } catch {
    throw new Error('INVALID_JSON_BODY');
  }
};

const normalizePageInput = (runtime, payload: PagePayload) => {
  const title = `${payload?.title ?? ''}`.trim();
  const slug = `${payload?.slug ?? ''}`.trim();
  const body = payload?.body;
  const publishedAt = `${payload?.publishedAt ?? ''}`.trim();
  const status = `${payload?.status ?? ''}`.trim().toLowerCase() === 'draft' ? 'draft' : 'published';

  if (!title || !slug) {
    return {
      valid: false,
      error: jsonResponse({
        error: {
          code: 'INVALID_PAGE_FIELDS',
          message: 'Fields "title" and "slug" are required.'
        }
      }, { statusCode: 400 })
    };
  }

  if (publishedAt) {
    const parsed = new Date(publishedAt);
    if (Number.isNaN(parsed.getTime())) {
      return {
        valid: false,
        error: jsonResponse({
          error: {
            code: 'INVALID_PAGE_FIELDS',
            message: 'Field "publishedAt" must be a valid datetime.'
          }
        }, { statusCode: 400 })
      };
    }
  }

  return {
    valid: true,
    data: {
      title,
      slug,
      ...(typeof body === 'undefined' ? {} : (hasField(runtime, 'page', 'content') ? { content: `${body}` } : { body: `${body}` })),
      ...(publishedAt ? (hasField(runtime, 'page', 'publishedAt') ? { publishedAt: new Date(publishedAt) } : {}) : {}),
      ...(hasField(runtime, 'page', 'status') ? { status } : {})
    }
  };
};

const notFoundPageResponse = () => jsonResponse({
  error: {
    code: 'PAGE_NOT_FOUND',
    message: 'Page not found.'
  }
}, { statusCode: 404 });

export const createPageController = (runtime) => {
  const router = createRouter([
    {
      method: 'GET',
      path: '/admin-api/pages',
      handler: () => jsonResponse(runtime.content.list('page'))
    },
    {
      method: 'GET',
      path: '/admin-api/pages/:id',
      handler: (context) => {
        const page = runtime.content.get('page', `${context.params?.id ?? ''}`);

        if (!page) {
          return notFoundPageResponse();
        }

        return jsonResponse(page);
      }
    },
    {
      method: 'POST',
      path: '/admin-api/pages',
      handler: async (context) => {
        let payload: Record<string, unknown>;

        try {
          payload = await readJsonBody(context.request);
        } catch {
          return jsonResponse({
            error: {
              code: 'INVALID_JSON_BODY',
              message: 'Request body must be a valid JSON object.'
            }
          }, { statusCode: 400 });
        }

        const normalized = normalizePageInput(runtime, payload);
        if (!normalized.valid) {
          return normalized.error;
        }

        const created = await runtime.content.create('page', normalized.data);
        return jsonResponse(created, { statusCode: 201 });
      }
    },
    {
      method: 'PUT',
      path: '/admin-api/pages/:id',
      handler: async (context) => {
        const existing = runtime.content.get('page', `${context.params?.id ?? ''}`);
        if (!existing) {
          return notFoundPageResponse();
        }

        let payload: Record<string, unknown>;

        try {
          payload = await readJsonBody(context.request);
        } catch {
          return jsonResponse({
            error: {
              code: 'INVALID_JSON_BODY',
              message: 'Request body must be a valid JSON object.'
            }
          }, { statusCode: 400 });
        }

        const normalized = normalizePageInput(runtime, payload);
        if (!normalized.valid) {
          return normalized.error;
        }

        const updated = await runtime.content.update('page', `${context.params?.id ?? ''}`, normalized.data);
        return jsonResponse(updated);
      }
    },
    {
      method: 'DELETE',
      path: '/admin-api/pages/:id',
      handler: async (context) => {
        const page = runtime.content.get('page', `${context.params?.id ?? ''}`);
        if (!page) {
          return notFoundPageResponse();
        }

        await runtime.content.delete('page', `${context.params?.id ?? ''}`);
        return noContentResponse();
      }
    }
  ]);

  return Object.freeze({
    dispatch: (context) => router.dispatch(context)
  });
};
