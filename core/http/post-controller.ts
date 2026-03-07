import { createRouter } from './router.ts';
import { jsonResponse, noContentResponse } from './response.ts';

type PostPayload = {
  title?: unknown,
  slug?: unknown,
  body?: unknown,
  publishedAt?: unknown
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

const normalizePostInput = (payload: PostPayload) => {
  const title = `${payload?.title ?? ''}`.trim();
  const slug = `${payload?.slug ?? ''}`.trim();
  const body = payload?.body;
  const publishedAt = `${payload?.publishedAt ?? ''}`.trim();

  if (!title || !slug) {
    return {
      valid: false,
      error: jsonResponse({
        error: {
          code: 'INVALID_POST_FIELDS',
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
            code: 'INVALID_POST_FIELDS',
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
      ...(typeof body === 'undefined' ? {} : { body: `${body}` }),
      ...(publishedAt ? { publishedAt: new Date(publishedAt) } : {})
    }
  };
};

const notFoundPostResponse = () => jsonResponse({
  error: {
    code: 'POST_NOT_FOUND',
    message: 'Post not found.'
  }
}, { statusCode: 404 });

export const createPostController = (runtime) => {
  const router = createRouter([
    {
      method: 'GET',
      path: '/admin-api/posts',
      handler: () => jsonResponse(runtime.content.list('post'))
    },
    {
      method: 'GET',
      path: '/admin-api/posts/:id',
      handler: (context) => {
        const post = runtime.content.get('post', `${context.params?.id ?? ''}`);

        if (!post) {
          return notFoundPostResponse();
        }

        return jsonResponse(post);
      }
    },
    {
      method: 'POST',
      path: '/admin-api/posts',
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

        const normalized = normalizePostInput(payload);
        if (!normalized.valid) {
          return normalized.error;
        }

        const created = await runtime.content.create('post', normalized.data);
        return jsonResponse(created, { statusCode: 201 });
      }
    },
    {
      method: 'PUT',
      path: '/admin-api/posts/:id',
      handler: async (context) => {
        const existing = runtime.content.get('post', `${context.params?.id ?? ''}`);
        if (!existing) {
          return notFoundPostResponse();
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

        const normalized = normalizePostInput(payload);
        if (!normalized.valid) {
          return normalized.error;
        }

        const updated = await runtime.content.update('post', `${context.params?.id ?? ''}`, normalized.data);
        return jsonResponse(updated);
      }
    },
    {
      method: 'DELETE',
      path: '/admin-api/posts/:id',
      handler: async (context) => {
        const post = runtime.content.get('post', `${context.params?.id ?? ''}`);
        if (!post) {
          return notFoundPostResponse();
        }

        await runtime.content.delete('post', `${context.params?.id ?? ''}`);
        return noContentResponse();
      }
    }
  ]);

  return Object.freeze({
    dispatch: (context) => router.dispatch(context)
  });
};
