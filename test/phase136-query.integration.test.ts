import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase136-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

test('phase 136: content storage query supports limit, offset, and sort', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const { runtime } = bootstrap;

  runtime.storage.create('post', { title: 'Gamma' });
  runtime.storage.create('post', { title: 'Alpha' });
  runtime.storage.create('post', { title: 'Beta' });

  const limited = runtime.storage.query('post', { limit: 2 });
  assert.equal(limited.length, 2);
  assert.deepEqual(limited.map((entry) => entry.id), ['1', '2']);

  const offset = runtime.storage.query('post', { offset: 1 });
  assert.equal(offset.length, 2);
  assert.deepEqual(offset.map((entry) => entry.id), ['2', '3']);

  const sortAsc = runtime.storage.query('post', { sort: 'title:asc' });
  assert.deepEqual(sortAsc.map((entry) => entry.data.title), ['Alpha', 'Beta', 'Gamma']);

  const sortDesc = runtime.storage.query('post', { sort: 'title:desc' });
  assert.deepEqual(sortDesc.map((entry) => entry.data.title), ['Gamma', 'Beta', 'Alpha']);
});


test('phase 136: content storage query validates content type', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const { runtime } = bootstrap;

  assert.throws(() => {
    runtime.storage.query('missing', {});
  }, /Unknown content type: missing/);
});
