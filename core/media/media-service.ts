import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLocalStorageAdapter } from './storage/local-storage.ts';

export type MediaRecord = {
  id: string
  filename: string
  mimeType: string
  size: number
  storagePath: string
  createdAt: string
};

type StoredSnapshot = {
  media?: MediaRecord[]
};

const asMediaList = (snapshot: StoredSnapshot | null | undefined): MediaRecord[] => {
  if (!Array.isArray(snapshot?.media)) {
    return [];
  }

  return snapshot.media
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: `${item.id ?? ''}`,
      filename: `${item.filename ?? ''}`,
      mimeType: `${item.mimeType ?? 'application/octet-stream'}`,
      size: Number(item.size ?? 0),
      storagePath: `${item.storagePath ?? ''}`,
      createdAt: `${item.createdAt ?? new Date().toISOString()}`
    }))
    .filter((item) => item.id && item.storagePath);
};

const createMetadataStore = ({ filePath = '/data/system/media.json' }: { filePath?: string } = {}) => {
  const read = async (): Promise<StoredSnapshot> => {
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : { media: [] };
    } catch (error) {
      if ((error as { code?: string })?.code === 'ENOENT') {
        return { media: [] };
      }

      throw error;
    }
  };

  const write = async (snapshot: StoredSnapshot) => {
    const directory = path.dirname(filePath);
    const tempPath = `${filePath}.tmp`;
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await fs.promises.rename(tempPath, filePath);
  };

  return Object.freeze({ read, write, filePath });
};

export const createMediaService = (runtime, options: { storage?: ReturnType<typeof createLocalStorageAdapter>; metadataStore?: ReturnType<typeof createMetadataStore> } = {}) => {
  const storage = options.storage ?? createLocalStorageAdapter({ rootDirectory: '/data/uploads' });
  const metadataStore = options.metadataStore ?? createMetadataStore();

  const list = async () => {
    const snapshot = await metadataStore.read();
    return asMediaList(snapshot).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  };

  return Object.freeze({
    async create(file: { filename: string; mimeType?: string; buffer: Buffer; size?: number }, meta: Record<string, unknown> = {}) {
      const storagePath = await storage.save({ filename: file.filename, buffer: file.buffer });
      const now = new Date().toISOString();
      const media: MediaRecord = Object.freeze({
        id: crypto.randomUUID(),
        filename: `${file.filename ?? 'upload.bin'}`,
        mimeType: `${file.mimeType ?? 'application/octet-stream'}`,
        size: Number(file.size ?? file.buffer.byteLength),
        storagePath,
        createdAt: now,
        ...meta
      }) as MediaRecord;

      const snapshot = await metadataStore.read();
      const records = asMediaList(snapshot);
      records.push(media);
      await metadataStore.write({ media: records });

      return media;
    },
    async get(id: string) {
      const records = await list();
      return records.find((item) => item.id === `${id ?? ''}`) ?? null;
    },
    async list() {
      return list();
    },
    async delete(id: string) {
      const snapshot = await metadataStore.read();
      const records = asMediaList(snapshot);
      const target = records.find((item) => item.id === `${id ?? ''}`) ?? null;

      if (!target) {
        return false;
      }

      await storage.delete(target.storagePath);
      const next = records.filter((item) => item.id !== target.id);
      await metadataStore.write({ media: next });
      return true;
    }
  });
};
