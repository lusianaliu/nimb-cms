import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRouter } from './router.ts';
import { jsonResponse } from './response.ts';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const toSafeName = (input: string) => {
  const parsed = path.parse(input || 'image');
  const stem = (parsed.name || 'image')
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '') || 'image';
  const ext = (parsed.ext || '').toLowerCase().replaceAll(/[^.a-z0-9]/g, '');
  return `${stem}${ext}`;
};

const resolveExtension = (filename: string, mimeType: string) => {
  const candidate = path.extname(filename || '').toLowerCase();
  if (candidate) {
    return candidate;
  }

  if (mimeType === 'image/jpeg') {
    return '.jpg';
  }
  if (mimeType === 'image/png') {
    return '.png';
  }
  if (mimeType === 'image/webp') {
    return '.webp';
  }
  if (mimeType === 'image/gif') {
    return '.gif';
  }

  return '.bin';
};

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
    const mimeType = mimeHeader?.split(':')[1]?.trim().toLowerCase() || 'application/octet-stream';
    const filename = filenameMatch?.[1] ?? '';

    return {
      filename,
      mimeType,
      buffer: Buffer.from(bodyText, 'binary')
    };
  }

  throw new Error('MISSING_FILE_FIELD');
};

const getMediaRoot = (rootDirectory: string) => path.resolve(rootDirectory, 'data', 'media');

const resolvePathInside = (root: string, relativePath: string) => {
  const absolutePath = path.resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  return absolutePath;
};

const listMediaFiles = async (rootDirectory: string) => {
  const mediaRoot = getMediaRoot(rootDirectory);

  const files: Array<{ url: string; filename: string }> = [];

  const visit = async (directory: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relative = path.relative(mediaRoot, fullPath).split(path.sep).join('/');
      files.push({
        url: `/media/${relative}`,
        filename: entry.name
      });
    }
  };

  await visit(mediaRoot);

  return files.sort((a, b) => a.url.localeCompare(b.url));
};

const getContentTypeFromExtension = (extension: string) => {
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  if (extension === '.gif') {
    return 'image/gif';
  }

  return 'application/octet-stream';
};

export const createMediaController = ({ rootDirectory = process.cwd() } = {}) => {
  const apiRouter = createRouter([
    {
      method: 'POST',
      path: '/admin-api/media/upload',
      handler: async (context) => {
        const contentType = `${context.request.headers['content-type'] ?? ''}`;
        if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
          return jsonResponse({ error: 'Unsupported upload body' }, { statusCode: 415 });
        }

        try {
          const body = await readBody(context.request, MAX_UPLOAD_SIZE);
          const upload = parseMultipartUpload(body, contentType);

          if (!upload.filename || upload.buffer.byteLength < 1) {
            return jsonResponse({ error: 'No file uploaded' }, { statusCode: 400 });
          }

          if (!ALLOWED_TYPES.has(upload.mimeType)) {
            return jsonResponse({ error: 'Unsupported media type' }, { statusCode: 415 });
          }

          const now = new Date();
          const year = `${now.getUTCFullYear()}`;
          const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');

          const mediaRoot = getMediaRoot(rootDirectory);
          const targetDirectory = path.join(mediaRoot, year, month);
          await fs.promises.mkdir(targetDirectory, { recursive: true });

          const safeName = toSafeName(upload.filename);
          const extension = resolveExtension(safeName, upload.mimeType);
          const stem = path.basename(safeName, path.extname(safeName)) || 'image';
          const unique = `${stem}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}${extension}`;
          const filePath = path.join(targetDirectory, unique);

          await fs.promises.writeFile(filePath, upload.buffer);

          return jsonResponse({ url: `/media/${year}/${month}/${unique}` });
        } catch (error) {
          if ((error as Error)?.message === 'UPLOAD_TOO_LARGE') {
            return jsonResponse({ error: 'Upload exceeds max size of 10MB' }, { statusCode: 413 });
          }

          return jsonResponse({ error: 'Invalid multipart upload' }, { statusCode: 400 });
        }
      }
    },
    {
      method: 'GET',
      path: '/admin-api/media/list',
      handler: async () => jsonResponse({ files: await listMediaFiles(rootDirectory) })
    }
  ]);

  const tryServeMediaAsset = async (response, requestPath: string) => {
    if (!requestPath.startsWith('/media/')) {
      return false;
    }

    const mediaRoot = getMediaRoot(rootDirectory);
    const relativePath = requestPath.replace(/^\/+media\//, '');
    const absolutePath = resolvePathInside(mediaRoot, relativePath);

    if (!absolutePath) {
      return false;
    }

    let stat;
    try {
      stat = await fs.promises.stat(absolutePath);
    } catch {
      return false;
    }

    if (!stat.isFile()) {
      return false;
    }

    const body = await fs.promises.readFile(absolutePath);
    response.writeHead(200, {
      'content-length': body.byteLength,
      'content-type': getContentTypeFromExtension(path.extname(absolutePath).toLowerCase())
    });
    response.end(body);
    return true;
  };

  return Object.freeze({
    dispatch(context) {
      if (!context.path.startsWith('/admin-api/media/')) {
        return null;
      }

      return apiRouter.dispatch(context);
    },
    tryServeMediaAsset
  });
};
