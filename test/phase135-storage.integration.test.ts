import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase135-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

test('phase 135: content storage engine supports create/get/update/delete/list', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const { runtime } = bootstrap;

  const created = runtime.storage.create('post', { title: 'First post' });
  assert.equal(created.id, '1');
  assert.equal(created.type, 'post');
  assert.equal(created.data.title, 'First post');

  const firstFile = path.join(cwd, 'data', 'content', 'post', '1.json');
  assert.equal(fs.existsSync(firstFile), true);

  const fetched = runtime.storage.get('post', created.id);
  assert.ok(fetched);
  assert.equal(fetched?.id, '1');
  assert.equal(fetched?.data.title, 'First post');

  const updated = runtime.storage.update('post', created.id, { title: 'Updated post' });
  assert.equal(updated.id, '1');
  assert.equal(updated.data.title, 'Updated post');

  const createdSecond = runtime.storage.create('post', { title: 'Second post' });
  assert.equal(createdSecond.id, '2');

  const listed = runtime.storage.list('post');
  assert.equal(listed.length, 2);
  assert.deepEqual(listed.map((entry) => entry.id), ['1', '2']);

  runtime.storage.delete('post', created.id);
  assert.equal(runtime.storage.get('post', created.id), undefined);

  const remaining = runtime.storage.list('post');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.id, '2');

  const indexFile = path.join(cwd, 'data', 'content', 'post', 'index.json');
  assert.equal(fs.existsSync(indexFile), true);
  const indexPayload = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as { lastId?: number };
  assert.equal(indexPayload.lastId, 2);
});
