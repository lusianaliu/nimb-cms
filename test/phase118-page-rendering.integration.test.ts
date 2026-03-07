import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase118-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 118: frontend renders page by slug using theme template variables', async () => {
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
        title: 'About Nimb',
        slug: 'about',
        body: 'This is the about page body.'
      })
    });

    assert.equal(createResponse.status, 201);

    const pageResponse = await fetch(`http://127.0.0.1:${port}/about`);
    assert.equal(pageResponse.status, 200);

    const html = await pageResponse.text();
    assert.equal(html.includes('<h1>About Nimb</h1>'), true);
    assert.equal(html.includes('<div>This is the about page body.</div>'), true);

    const missingResponse = await fetch(`http://127.0.0.1:${port}/missing-page`);
    assert.equal(missingResponse.status, 404);
  } finally {
    await server.stop();
  }
});
