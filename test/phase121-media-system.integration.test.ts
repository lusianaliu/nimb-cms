import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase121-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 121: media upload API stores files under data/media/YYYY/MM and returns list', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const now = new Date();
    const year = `${now.getUTCFullYear()}`;
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');

    const form = new FormData();
    form.set('file', new Blob(['fake image payload'], { type: 'image/png' }), 'phase121-image.png');

    const uploadResponse = await fetch(`http://127.0.0.1:${port}/admin-api/media/upload`, {
      method: 'POST',
      body: form
    });

    assert.equal(uploadResponse.status, 200);
    const uploadJson = await uploadResponse.json() as { url?: string };
    assert.match(`${uploadJson.url ?? ''}`, new RegExp(`^/media/${year}/${month}/`));

    const relative = `${uploadJson.url ?? ''}`.replace(/^\/media\//, '');
    const storedPath = path.join(cwd, 'data', 'media', ...relative.split('/'));
    assert.equal(fs.existsSync(storedPath), true);
    assert.equal(fs.readFileSync(storedPath, 'utf8'), 'fake image payload');

    const listResponse = await fetch(`http://127.0.0.1:${port}/admin-api/media/list`);
    assert.equal(listResponse.status, 200);
    const listJson = await listResponse.json() as { files?: Array<{ url?: string }> };

    assert.equal(Array.isArray(listJson.files), true);
    assert.equal(listJson.files?.some((item) => item.url === uploadJson.url), true);
  } finally {
    await server.stop();
  }
});
