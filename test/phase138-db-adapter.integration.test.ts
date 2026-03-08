import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase138-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

test('phase 138: runtime db adapter supports create/get/update/delete/query with storage proxy compatibility', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const { runtime } = bootstrap;

  const created = runtime.db.create('post', { title: 'First post' });
  assert.equal(created.id, '1');
  assert.equal(created.type, 'post');
  assert.equal(created.data.title, 'First post');

  const fetched = runtime.db.get('post', created.id);
  assert.equal(fetched?.id, '1');
  assert.equal(fetched?.data.title, 'First post');

  const updated = runtime.db.update('post', created.id, { title: 'Updated post' });
  assert.equal(updated.id, '1');
  assert.equal(updated.data.title, 'Updated post');

  runtime.db.create('post', { title: 'Second post' });

  const queried = runtime.db.query('post', { sort: 'title:asc' });
  assert.equal(queried.length, 2);
  assert.deepEqual(queried.map((entry) => entry.data.title), ['Second post', 'Updated post']);

  runtime.db.delete('post', created.id);
  assert.equal(runtime.db.get('post', created.id), undefined);

  const remaining = runtime.db.query('post');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.id, '2');

  const viaStorageProxy = runtime.storage.list('post');
  assert.equal(viaStorageProxy.length, 1);
  assert.equal(viaStorageProxy[0]?.id, '2');
});
