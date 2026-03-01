import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sanitizeFilename = (filename: string): string => {
  const baseName = path.basename(filename).replaceAll(/[^a-zA-Z0-9._-]/g, '-');
  return baseName.replaceAll(/-+/g, '-').replaceAll(/^[-.]+|[-.]+$/g, '') || 'upload.bin';
};

const ensureSubPath = (rootDirectory: string, targetPath: string): string => {
  const resolvedRoot = path.resolve(rootDirectory);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Unsafe storage path');
  }

  return resolvedTarget;
};

export const createLocalStorageAdapter = ({ rootDirectory = '/data/uploads' }: { rootDirectory?: string } = {}) => {
  const resolvedRoot = path.resolve(rootDirectory);

  const ensureRoot = () => {
    fs.mkdirSync(resolvedRoot, { recursive: true });
  };

  return Object.freeze({
    rootDirectory: resolvedRoot,
    async save(file: { filename: string; buffer: Buffer }) {
      ensureRoot();

      const safeName = sanitizeFilename(file.filename);
      const extension = path.extname(safeName);
      const stem = safeName.slice(0, Math.max(0, safeName.length - extension.length)) || 'upload';
      const uniqueSuffix = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
      const uniqueName = `${stem}-${uniqueSuffix}${extension}`;
      const absolutePath = ensureSubPath(resolvedRoot, path.join(resolvedRoot, uniqueName));

      await fs.promises.writeFile(absolutePath, file.buffer);
      return `/uploads/${uniqueName}`;
    },
    async delete(storagePath: string) {
      const relative = `${storagePath ?? ''}`.replace(/^\/+uploads\/?/, '');
      if (!relative) {
        return;
      }

      const absolutePath = ensureSubPath(resolvedRoot, path.join(resolvedRoot, path.basename(relative)));
      await fs.promises.rm(absolutePath, { force: true });
    }
  });
};
