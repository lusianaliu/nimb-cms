import fs from 'node:fs/promises';
import path from 'node:path';
import { StorageAdapter } from './storage-adapter.ts';
import { deterministicJson } from './persistence-snapshot.ts';

const normalizeKey = (key) => `${String(key ?? '').replace(/\\/g, '/').replace(/\/+/, '/').replace(/^\/+|\/+$/g, '')}`;

const fileFromKey = (key) => `${normalizeKey(key)}.json`;

export class FileSystemStorageAdapter extends StorageAdapter {
  constructor({ rootDirectory = path.join(process.cwd(), 'data', 'system') } = {}) {
    super();
    this.rootDirectory = rootDirectory;
  }

  async read(key) {
    const filePath = path.join(this.rootDirectory, fileFromKey(key));

    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async write(key, data) {
    const fileName = fileFromKey(key);
    const filePath = path.join(this.rootDirectory, fileName);
    const tempPath = `${filePath}.tmp`;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tempPath, deterministicJson(data), 'utf8');
    await fs.rename(tempPath, filePath);

    return Object.freeze({ key: normalizeKey(key), filePath });
  }

  async delete(key) {
    const filePath = path.join(this.rootDirectory, fileFromKey(key));

    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async list(prefix = '') {
    const normalizedPrefix = normalizeKey(prefix);

    try {
      const entries = await fs.readdir(this.rootDirectory, { withFileTypes: true });
      return Object.freeze(entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name.slice(0, -'.json'.length))
        .filter((key) => key.startsWith(normalizedPrefix))
        .sort((left, right) => left.localeCompare(right)));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return Object.freeze([]);
      }
      throw error;
    }
  }
}
