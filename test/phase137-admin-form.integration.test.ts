import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createAdminContentRouter } from '../core/http/admin-content-router.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase137-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

const makeContext = (method: string, requestPath: string, body = '') => ({
  method,
  path: requestPath,
  request: Object.assign(Readable.from([body]), {
    headers: { 'x-nimb-capabilities': 'content.write', 'content-type': 'application/x-www-form-urlencoded' }
  }),
  response: {},
  params: {}
});

test('phase 137: admin form generator renders and handles create/update submit routes', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const { runtime } = bootstrap;

  runtime.admin = Object.freeze({
    ...(runtime.admin ?? {}),
    middleware: Object.freeze({ list: () => [] })
  });

  runtime.contentTypes.register({
    name: 'article',
    label: 'Article',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'views', type: 'number' },
      { name: 'published', type: 'boolean' },
      { name: 'publishDate', type: 'date' },
      { name: 'meta', type: 'json' }
    ]
  });

  const router = createAdminContentRouter(runtime);

  const getNewContext = makeContext('GET', '/admin/content/article/new');
  const getNewHandler = router.dispatch(getNewContext);
  assert.ok(getNewHandler);
  const getNewResponse = await getNewHandler(getNewContext);

  const newChunks: Buffer[] = [];
  getNewResponse.send({
    writeHead: () => undefined,
    end: (chunk?: Buffer) => { if (chunk) { newChunks.push(chunk); } }
  });
  const newHtml = Buffer.concat(newChunks).toString('utf8');
  assert.equal(newHtml.includes('<form method="POST" action="/admin/content/article">'), true);
  assert.equal(newHtml.includes('name="title" type="text"'), true);
  assert.equal(newHtml.includes('name="views" type="number"'), true);
  assert.equal(newHtml.includes('name="published" type="checkbox"'), true);
  assert.equal(newHtml.includes('name="publishDate" type="date"'), true);
  assert.equal(newHtml.includes('<textarea id="meta" name="meta"'), true);

  const createContext = makeContext(
    'POST',
    '/admin/content/article',
    new URLSearchParams({
      title: 'Phase 137 Entry',
      views: '5',
      published: 'true',
      publishDate: '2026-02-01',
      meta: '{"origin":"form"}'
    }).toString()
  );
  const createHandler = router.dispatch(createContext);
  assert.ok(createHandler);
  const createResponse = await createHandler(createContext);
  assert.equal(createResponse.statusCode, 302);

  const createdEntries = runtime.storage.list('article');
  assert.equal(createdEntries.length, 1);
  assert.equal(createdEntries[0]?.data?.title, 'Phase 137 Entry');
  const createdId = createdEntries[0]?.id;
  assert.ok(createdId);

  const updateContext = makeContext(
    'POST',
    `/admin/content/article/${encodeURIComponent(createdId)}/edit`,
    new URLSearchParams({
      title: 'Phase 137 Entry Updated',
      views: '8',
      published: 'false',
      publishDate: '2026-02-02',
      meta: '{"origin":"edit"}'
    }).toString()
  );
  const updateHandler = router.dispatch(updateContext);
  assert.ok(updateHandler);
  const updateResponse = await updateHandler(updateContext);
  assert.equal(updateResponse.statusCode, 302);

  const updated = runtime.storage.get('article', createdId);
  assert.equal(updated?.data?.title, 'Phase 137 Entry Updated');
  assert.equal(updated?.data?.views, 8);
  assert.equal(updated?.data?.published, false);
});
