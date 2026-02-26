import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonStorageAdapter } from '../core/storage/json-storage-adapter.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-json-storage-'));

test('json storage adapter returns empty snapshot when file is missing', async () => {
  const rootDirectory = mkdtemp();
  const adapter = new JsonStorageAdapter({ rootDirectory });

  const snapshot = await adapter.loadContentSnapshot();
  assert.deepEqual(snapshot, { entries: {} });
});

test('json storage adapter writes atomically and reloads snapshot', async () => {
  const rootDirectory = mkdtemp();
  const adapter = new JsonStorageAdapter({ rootDirectory });

  const payload = {
    entries: {
      page: {
        id1: {
          id: 'id1',
          type: 'page',
          data: { title: 'Hello', slug: 'hello' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      }
    }
  };

  await adapter.saveContentSnapshot(payload);

  const filePath = path.join(rootDirectory, 'content.json');
  assert.equal(fs.existsSync(filePath), true);
  assert.equal(fs.existsSync(`${filePath}.tmp`), false);

  const restored = await adapter.loadContentSnapshot();
  assert.deepEqual(restored, payload);
});

test('json storage adapter throws descriptive parse errors', async () => {
  const rootDirectory = mkdtemp();
  const filePath = path.join(rootDirectory, 'content.json');
  fs.mkdirSync(rootDirectory, { recursive: true });
  fs.writeFileSync(filePath, '{ bad json', 'utf8');

  const adapter = new JsonStorageAdapter({ rootDirectory });

  await assert.rejects(
    () => adapter.loadContentSnapshot(),
    /Failed to parse content snapshot JSON/
  );
});
