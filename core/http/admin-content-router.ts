import { createRouter } from './router.ts';
import { createContentAdminService } from '../admin/content-admin.ts';
import { renderContentList } from '../admin/views/content-list.ts';
import { renderContentForm } from '../admin/views/content-form.ts';
import { renderAdminShell } from '../admin/admin-shell.ts';

const SUPPORTED_TYPES = new Set(['page', 'post']);

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

const getRequestedType = (context) => {
  const rawType = `${context.params?.type ?? ''}`.trim();
  if (!SUPPORTED_TYPES.has(rawType)) {
    return null;
  }

  return rawType;
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

  return `${rawValue ?? ''}`;
};

const buildEntryData = (schema, formData: Record<string, unknown>, existingEntries, currentId?: string) => {
  const data: Record<string, unknown> = {};

  for (const field of schema?.fields ?? []) {
    const name = `${field?.name ?? ''}`;
    const raw = formData[name];
    data[name] = coerceFieldValue(`${field?.type ?? 'string'}`, raw);
  }

  if (!`${data.slug ?? ''}`.trim()) {
    data.slug = slugify(data.title);
  }

  data.slug = withUniqueSlug(existingEntries, slugify(data.slug), currentId);

  return data;
};

export const createAdminContentRouter = (runtime) => {
  const service = createContentAdminService(runtime);
  const router = createRouter([
    {
      method: 'GET',
      path: '/admin/content/:type',
      handler: (context) => {
        const type = getRequestedType(context);
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
      }
    },
    {
      method: 'GET',
      path: '/admin/content/:type/new',
      handler: (context) => {
        const type = getRequestedType(context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const schema = runtime.content.getTypeSchema(type);
        return toHtmlResponse(renderAdminShell({
          title: `Create ${type} · ${runtime?.admin?.title ?? 'Nimb Admin'}`,
          runtime,
          activeNav: 'content',
          content: renderContentForm({ type, schema, entry: null, mode: 'new' })
        }));
      }
    },
    {
      method: 'GET',
      path: '/admin/content/:type/:id/edit',
      handler: (context) => {
        const type = getRequestedType(context);
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
          content: renderContentForm({ type, schema, entry, mode: 'edit' })
        }));
      }
    },
    {
      method: 'POST',
      path: '/admin/content/:type',
      handler: async (context) => {
        const type = getRequestedType(context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const schema = runtime.content.getTypeSchema(type);
        const formData = await parseFormBody(context.request);
        const existingEntries = service.listEntries(type);
        const entryData = buildEntryData(schema, formData, existingEntries);

        await service.createEntry(type, entryData);
        return toRedirectResponse(`/admin/content/${encodeURIComponent(type)}`);
      }
    },
    {
      method: 'POST',
      path: '/admin/content/:type/:id/update',
      handler: async (context) => {
        const type = getRequestedType(context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        const id = `${context.params?.id ?? ''}`;
        const schema = runtime.content.getTypeSchema(type);
        const formData = await parseFormBody(context.request);
        const existingEntries = service.listEntries(type);
        const entryData = buildEntryData(schema, formData, existingEntries, id);

        await service.updateEntry(type, id, entryData);
        return toRedirectResponse(`/admin/content/${encodeURIComponent(type)}`);
      }
    },
    {
      method: 'POST',
      path: '/admin/content/:type/:id/delete',
      handler: async (context) => {
        const type = getRequestedType(context);
        if (!type) {
          return toTextResponse(404, 'Not found');
        }

        await service.deleteEntry(type, `${context.params?.id ?? ''}`);
        return toRedirectResponse(`/admin/content/${encodeURIComponent(type)}`);
      }
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
