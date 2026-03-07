import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase117-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 117: page CRUD API uses runtime content system', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const createResponse = await fetch(`http://127.0.0.1:${port}/admin-api/pages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Welcome',
        slug: 'welcome',
        body: 'Hello from phase 117'
      })
    });

    assert.equal(createResponse.status, 201);
    const createdPage = await createResponse.json();
    assert.equal(createdPage.type, 'page');
    assert.equal(createdPage.data.title, 'Welcome');
    assert.equal(createdPage.data.slug, 'welcome');
    assert.equal(createdPage.data.body, 'Hello from phase 117');

    const listResponse = await fetch(`http://127.0.0.1:${port}/admin-api/pages`);
    assert.equal(listResponse.status, 200);
    const pages = await listResponse.json();
    assert.equal(Array.isArray(pages), true);
    assert.equal(pages.some((entry) => entry.id === createdPage.id), true);

    const getResponse = await fetch(`http://127.0.0.1:${port}/admin-api/pages/${createdPage.id}`);
    assert.equal(getResponse.status, 200);
    const fetchedPage = await getResponse.json();
    assert.equal(fetchedPage.id, createdPage.id);
    assert.equal(fetchedPage.data.slug, 'welcome');

    const updateResponse = await fetch(`http://127.0.0.1:${port}/admin-api/pages/${createdPage.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Welcome Updated',
        slug: 'welcome-updated',
        body: 'Updated body'
      })
    });

    assert.equal(updateResponse.status, 200);
    const updatedPage = await updateResponse.json();
    assert.equal(updatedPage.id, createdPage.id);
    assert.equal(updatedPage.data.title, 'Welcome Updated');
    assert.equal(updatedPage.data.slug, 'welcome-updated');
    assert.equal(updatedPage.data.body, 'Updated body');

    const deleteResponse = await fetch(`http://127.0.0.1:${port}/admin-api/pages/${createdPage.id}`, {
      method: 'DELETE'
    });

    assert.equal(deleteResponse.status, 204);

    const getDeletedResponse = await fetch(`http://127.0.0.1:${port}/admin-api/pages/${createdPage.id}`);
    assert.equal(getDeletedResponse.status, 404);
  } finally {
    await server.stop();
  }
});
