import { createRouter } from './router.ts';
import { renderAdminShell } from '../admin/admin-shell.ts';
import { renderMediaList } from '../admin/views/media-list.ts';
import { renderMediaUpload } from '../admin/views/media-upload.ts';
import { runMiddlewareStack } from './run-middleware.ts';
import type { MiddlewareContext } from './middleware.ts';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

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

const readBody = async (request, maxSize = MAX_UPLOAD_SIZE): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += next.byteLength;

    if (total > maxSize) {
      throw new Error('UPLOAD_TOO_LARGE');
    }

    chunks.push(next);
  }

  return Buffer.concat(chunks);
};

const parseMultipartUpload = (body: Buffer, contentType: string) => {
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    throw new Error('INVALID_MULTIPART_BOUNDARY');
  }

  const boundary = boundaryMatch[1]?.trim().replace(/^"|"$/g, '');
  if (!boundary) {
    throw new Error('INVALID_MULTIPART_BOUNDARY');
  }

  const delimiter = `--${boundary}`;
  const raw = body.toString('binary');
  const parts = raw.split(delimiter).slice(1, -1);

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const splitIndex = trimmed.indexOf('\r\n\r\n');
    if (splitIndex < 0) {
      continue;
    }

    const headerText = trimmed.slice(0, splitIndex);
    const bodyText = trimmed.slice(splitIndex + 4);
    const headers = headerText.split('\r\n');
    const disposition = headers.find((header) => /^content-disposition:/i.test(header));

    if (!disposition || !disposition.includes('name="file"')) {
      continue;
    }

    const filenameMatch = disposition.match(/filename="([^"]*)"/i);
    const mimeHeader = headers.find((header) => /^content-type:/i.test(header));
    const mimeType = mimeHeader?.split(':')[1]?.trim() || 'application/octet-stream';
    const filename = filenameMatch?.[1] ?? '';

    return {
      filename,
      mimeType,
      buffer: Buffer.from(bodyText, 'binary')
    };
  }

  throw new Error('MISSING_FILE_FIELD');
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
export const createAdminMediaRouter = (runtime) => {
  const router = createRouter([
    {
      method: 'GET',
      path: '/admin/media',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const media = await runtime.media.list();
        return toHtmlResponse(renderAdminShell({
          title: `Media · ${runtime?.admin?.title ?? 'Nimb Admin'}`,
          runtime,
          activeNav: 'media',
          content: renderMediaList({ media })
        }));
      })
    },
    {
      method: 'GET',
      path: '/admin/media/upload',
      handler: (context) => withAdminMiddleware(runtime, context, async () => toHtmlResponse(renderAdminShell({
        title: `Upload media · ${runtime?.admin?.title ?? 'Nimb Admin'}`,
        runtime,
        activeNav: 'media',
        content: renderMediaUpload()
      })))
    },
    {
      method: 'POST',
      path: '/admin/media/upload',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        const contentType = `${context.request.headers['content-type'] ?? ''}`;
        if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
          return toTextResponse(415, 'Unsupported upload body');
        }

        try {
          const body = await readBody(context.request, MAX_UPLOAD_SIZE);
          const upload = parseMultipartUpload(body, contentType);
          if (!upload.filename || upload.buffer.byteLength < 1) {
            return toTextResponse(400, 'No file uploaded');
          }

          await runtime.media.create({
            filename: upload.filename,
            mimeType: upload.mimeType,
            buffer: upload.buffer,
            size: upload.buffer.byteLength
          });
          runtime.renderCache?.invalidate?.();
          return toRedirectResponse('/admin/media');
        } catch (error) {
          if ((error as Error)?.message === 'UPLOAD_TOO_LARGE') {
            return toTextResponse(413, 'Upload exceeds max size of 10MB');
          }

          return toTextResponse(400, 'Invalid multipart upload');
        }
      })
    },
    {
      method: 'POST',
      path: '/admin/media/:id/delete',
      handler: (context) => withAdminMiddleware(runtime, context, async () => {
        await runtime.media.delete(`${context.params?.id ?? ''}`);
        runtime.renderCache?.invalidate?.();
        return toRedirectResponse('/admin/media');
      })
    }
  ]);

  return Object.freeze({
    dispatch(context) {
      if (!context.path.startsWith('/admin/media')) {
        return null;
      }

      return router.dispatch(context);
    }
  });
};
