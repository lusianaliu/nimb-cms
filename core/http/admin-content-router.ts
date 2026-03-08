import { createRouter } from './router.ts';
import { createContentAdminService } from '../admin/content-admin.ts';
import { renderContentList } from '../admin/views/content-list.ts';
import { generateAdminForm } from '../admin/form-generator.ts';
import { renderAdminShell } from '../admin/admin-shell.ts';
import { runMiddlewareStack } from './run-middleware.ts';
import type { MiddlewareContext } from './middleware.ts';

const toHtmlResponse = (html: string, statusCode = 200) => ({
  statusCode,
  send(response) {
    const body = Buffer.from(html, 'utf8');
    response.writeHead(statusCode, {
      'content-length': body.byteLength,
      'content-type': 'text/html; charset=utf-8'
    });
    response.end(body);
  }
});

const toRedirectResponse = (location: string, statusCode = 302) => ({
  statusCode,
  send(response) {
    response.writeHead(statusCode, { location, 'content-length': '0' });
    response.end();
  }
});

const toTextResponse = (statusCode: number, text: string) => ({
  statusCode,
  send(response) {
    const body = Buffer.from(text, 'utf8');
    response.writeHead(statusCode, {
      'content-length': body.byteLength,
      'content-type': 'text/plain; charset=utf-8'
    });
    response.end(body);
  }
});

const getRequestedType = (runtime, context) => {
  const rawType = `${context.params?.type ?? ''}`.trim();
  if (!rawType) {
    return null;
  }

  return runtime.contentTypes?.get(rawType) ? rawType : null;
};

const hasCapability = (context, capability: string) => {
  const raw = context.request.headers['x-nimb-capabilities'];
  if (typeof raw !== 'string') {
    return false;
  }

  return raw.split(',').map((entry) => entry.trim()).includes(capability);
};

const parseFormBody = async (request) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return Object.fromEntries(new URLSearchParams(body));
};

const assertFieldTypes = (runtime, schema, data: Record<string, unknown>) => {
  for (const field of schema?.fields ?? []) {
    const name = `${field?.name ?? ''}`;
    const fieldTypeName = `${field?.type ?? 'string'}`;
    const fieldType = runtime.fieldTypes?.get?.(fieldTypeName);

    if (!fieldType) {
      throw new Error(`Unknown field type "${fieldTypeName}" for field "${name}"`);
    }

    if (data[name] === undefined) {
      if (field?.required) {
        throw new Error(`Missing required field "${name}"`);
      }
      continue;
    }

    if (!fieldType.validate(data[name])) {
      throw new Error(`Invalid value for field "${name}"`);
    }
  }
};

const slugify = (value: unknown) => `${value ?? ''}`
  .trim()
  .toLowerCase()
  .replaceAll(/[^a-z0-9\s-]/g, '')
  .replaceAll(/\s+/g, '-')
  .replaceAll(/-+/g, '-')
  .replaceAll(/^-|-$/g, '');

const withUniqueSlug = (entries, candidate: string, currentId?: string) => {
  if (!candidate) {
    return '';
  }

  const slugs = new Set(entries
    .filter((entry) => `${entry?.id ?? ''}` !== `${currentId ?? ''}`)
    .map((entry) => `${entry?.data?.slug ?? ''}`));

  if (!slugs.has(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (slugs.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }

  return `${candidate}-${suffix}`;
};

const coerceFieldValue = (type: string, rawValue: unknown) => {
  if (type === 'boolean') {
    return rawValue === 'true' || rawValue === 'on' || rawValue === true;
  }

  if (type === 'number') {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (type === 'date' || type === 'datetime') {
    const text = `${rawValue ?? ''}`.trim();
    if (!text) {
      return undefined;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  if (type === 'json') {
    const text = `${rawValue ?? ''}`.trim();
    if (!text) {
      return null;
    }

    return JSON.parse(text);
  }

  return `${rawValue ?? ''}`;
};

const buildEntryData = (schema, formData: Record<string, unknown>, existingEntries, currentId?: string) => {
  const data: Record<string, unknown> = {};

  for (const field of schema?.fields ?? []) {
    const name = `${field?.name ?? ''}`;
    const raw = formData[name];
    const value = coerceFieldValue(`${field?.type ?? 'string'}`, raw);
    if (typeof value !== 'undefined') {
      data[name] = value;
    }
  }

  const hasSlugField = (schema?.fields ?? []).some((field) => `${field?.name ?? ''}` === 'slug');
  if (hasSlugField) {
    if (!`${data.slug ?? ''}`.trim()) {
      data.slug = slugify(data.title);
    }

    data.slug = withUniqueSlug(existingEntries, slugify(data.slug), currentId);
  }

  return data;
};


const renderGeneratedContentForm = ({ type, schema, entry, mode }) => {
  const safeType = encodeURIComponent(type);
  const action = mode === 'edit'
    ? `/admin/content/${safeType}/${encodeURIComponent(`${entry?.id ?? ''}`)}/edit`
    : `/admin/content/${safeType}`;

  const formHtml = generateAdminForm(schema, {
    action,
    values: entry?.data ?? {},
    submitLabel: 'Save'
  });

  return `<h1>${mode === 'edit' ? 'Edit' : 'Create'} ${type}</h1>
  ${formHtml}
  <p><a href="/admin/content/${safeType}">Cancel</a></p>`;
};



const withAdminMiddleware = (runtime, context, handler: () => Promise<unknown> | unknown) => {
  const middlewareContext: MiddlewareContext = {
    req: context.request,
    res: context.response,
    runtime,
    params: context.params,
    state: {}
  };

  let output: unknown = null;

  return runMiddlewareStack(
    middlewareContext,
    runtime?.admin?.middleware?.list?.() ?? [],
    async () => {
      output = await Promise.resolve(handler());
    }
  ).then(() => output ?? middlewareContext.state.response ?? null);
};
export const createAdminContentRouter = (runtime) => {
  const service = createContentAdminService(runtime);
  const router = createRouter([
    {
      method: 'GET',
      path: '/admin/content/:type',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const type = getRequestedType(runtime, context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const entries = service.listEntries(type);
        return toHtmlResponse(renderAdminShell({
          title: `Content · ${runtime?.admin?.title ?? 'Nimb Admin'}`,
          runtime,
          activeNav: 'content',
          content: renderContentList({ type, entries })
        }));
      })
    },
    {
      method: 'GET',
      path: '/admin/content/:type/new',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const type = getRequestedType(runtime, context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const schema = runtime.content.getTypeSchema(type);
        return toHtmlResponse(renderAdminShell({
          title: `Create ${type} · ${runtime?.admin?.title ?? 'Nimb Admin'}`,
          runtime,
          activeNav: 'content',
          content: renderGeneratedContentForm({ type, schema, entry: null, mode: 'new' })
        }));
      })
    },
    {
      method: 'GET',
      path: '/admin/content/:type/:id/edit',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const type = getRequestedType(runtime, context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const entry = service.getEntry(type, `${context.params?.id ?? ''}`);
        if (!entry) {
          return toTextResponse(404, 'Not found');
        }

        const schema = runtime.content.getTypeSchema(type);
        return toHtmlResponse(renderAdminShell({
          title: `Edit ${type} · ${runtime?.admin?.title ?? 'Nimb Admin'}`,
          runtime,
          activeNav: 'content',
          content: renderGeneratedContentForm({ type, schema, entry, mode: 'edit' })
        }));
      })
    },
    {
      method: 'POST',
      path: '/admin/content/:type',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const type = getRequestedType(runtime, context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const schema = runtime.content.getTypeSchema(type);
        const formData = await parseFormBody(context.request);
        const existingEntries = service.listEntries(type);
        const entryData = buildEntryData(schema, formData, existingEntries);

        assertFieldTypes(runtime, schema, entryData);

        runtime.storage.create(type, entryData);
        runtime.content?.invalidateRenderCache?.();
        return toRedirectResponse(`/admin/content/${encodeURIComponent(type)}`);
      }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Invalid form submission';
        return toTextResponse(400, message);
      })
    },
    {
      method: 'POST',
      path: '/admin/content/:type/:id/edit',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const type = getRequestedType(runtime, context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const id = `${context.params?.id ?? ''}`;
        const schema = runtime.content.getTypeSchema(type);
        const formData = await parseFormBody(context.request);
        const existingEntries = service.listEntries(type);
        const entryData = buildEntryData(schema, formData, existingEntries, id);

        assertFieldTypes(runtime, schema, entryData);

        runtime.storage.update(type, id, entryData);
        runtime.content?.invalidateRenderCache?.();
        return toRedirectResponse(`/admin/content/${encodeURIComponent(type)}`);
      }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Invalid form submission';
        return toTextResponse(400, message);
      })
    },
    {
      method: 'POST',
      path: '/admin/content/:type/:id/update',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const type = getRequestedType(runtime, context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const id = `${context.params?.id ?? ''}`;
        const schema = runtime.content.getTypeSchema(type);
        const formData = await parseFormBody(context.request);
        const existingEntries = service.listEntries(type);
        const entryData = buildEntryData(schema, formData, existingEntries, id);

        assertFieldTypes(runtime, schema, entryData);

        runtime.storage.update(type, id, entryData);
        runtime.content?.invalidateRenderCache?.();
        return toRedirectResponse(`/admin/content/${encodeURIComponent(type)}`);
      }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Invalid form submission';
        return toTextResponse(400, message);
      })
    },
    {
      method: 'POST',
      path: '/admin/content/:type/:id/delete',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const type = getRequestedType(runtime, context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        await service.deleteEntry(type, `${context.params?.id ?? ''}`);
        return toRedirectResponse(`/admin/content/${encodeURIComponent(type)}`);
      })
    }
  ]);

  return Object.freeze({
    dispatch(context) {
      if (!context.path.startsWith('/admin/content')) {
        return null;
      }

      if (!hasCapability(context, 'content.write')) {
        return () => toTextResponse(403, 'Forbidden');
      }

      return router.dispatch(context);
    }
  });
};
