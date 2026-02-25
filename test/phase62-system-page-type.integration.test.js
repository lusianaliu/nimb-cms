import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase62c-'));

const writeConfig = (cwd) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd, version = '1.0.0') => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version, installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

test('phase 62C: normal runtime bootstraps built-in page content type', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd, '62.0.0');

  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  const pageType = bootstrap.runtime.contentTypes.get('page');

  assert.ok(pageType);
  assert.equal(pageType.name, 'Page');
  assert.deepEqual(pageType.fields, [
    { name: 'title', type: 'string', required: true },
    { name: 'slug', type: 'string', required: true },
    { name: 'body', type: 'text' },
    { name: 'published', type: 'boolean' }
  ]);
});

test('phase 62C: repeated normal bootstrap avoids duplicate system page registration errors', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd, '62.0.1');

  const firstBootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  await firstBootstrap.runtime.start();

  const secondBootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:01.000Z' });
  const pageType = secondBootstrap.runtime.contentTypes.get('page');

  assert.ok(pageType);
  assert.equal(pageType.slug, 'page');
  assert.equal(secondBootstrap.runtime.contentTypes.list().filter((contentType) => contentType.slug === 'page').length, 1);
});
