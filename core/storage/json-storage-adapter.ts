import fs from 'node:fs/promises';
import path from 'node:path';
import type { ContentSnapshot, StorageAdapter } from './storage-adapter.ts';

const CONTENT_FILENAME = 'content.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const emptySnapshot = (): ContentSnapshot => ({ entries: {} });

export class JsonStorageAdapter implements StorageAdapter {
  readonly filePath: string;

  constructor({ rootDirectory = path.join(process.cwd(), 'data') }: { rootDirectory?: string } = {}) {
    this.filePath = path.join(rootDirectory, CONTENT_FILENAME);
  }

  async loadContentSnapshot(): Promise<ContentSnapshot> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);

      if (!isRecord(parsed) || !isRecord(parsed.entries)) {
        throw new Error('Snapshot must be an object with an "entries" object');
      }

      return {
        entries: { ...parsed.entries }
      };
    } catch (error) {
      if ((error as { code?: string })?.code === 'ENOENT') {
        return emptySnapshot();
      }

      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse content snapshot JSON at ${this.filePath}: ${error.message}`);
      }

      if (error instanceof Error && error.message.includes('Snapshot must be an object')) {
        throw new Error(`Invalid content snapshot structure at ${this.filePath}: ${error.message}`);
      }

      throw error;
    }
  }

  async saveContentSnapshot(snapshot: ContentSnapshot): Promise<void> {
    const directory = path.dirname(this.filePath);
    const tempPath = `${this.filePath}.tmp`;

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, this.filePath);
  }
}
