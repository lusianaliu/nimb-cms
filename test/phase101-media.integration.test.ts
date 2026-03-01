import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const MEDIA_STATE_PATH = '/data/system/media.json';
const UPLOADS_DIR = '/data/uploads';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase101-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};


const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '101.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}
`);
};

const backupFile = (filePath: string) => fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;

const restoreFile = (filePath: string, content: string | null) => {
  if (content === null) {
    fs.rmSync(filePath, { force: true });
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const withInstallAndMediaState = async (run: () => Promise<void> | void) => {
  const installBackup = backupFile(INSTALL_STATE_PATH);
  const mediaBackup = backupFile(MEDIA_STATE_PATH);
  const uploadsBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-uploads-backup-'));
  const uploadsExisted = fs.existsSync(UPLOADS_DIR);

  if (uploadsExisted) {
    for (const file of fs.readdirSync(UPLOADS_DIR)) {
      fs.copyFileSync(path.join(UPLOADS_DIR, file), path.join(uploadsBackupDir, file));
    }
  }

  try {
    fs.rmSync(MEDIA_STATE_PATH, { force: true });
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    await run();
  } finally {
    restoreFile(INSTALL_STATE_PATH, installBackup);
    restoreFile(MEDIA_STATE_PATH, mediaBackup);
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    if (uploadsExisted) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      for (const file of fs.readdirSync(uploadsBackupDir)) {
        fs.copyFileSync(path.join(uploadsBackupDir, file), path.join(UPLOADS_DIR, file));
      }
    }
    fs.rmSync(uploadsBackupDir, { recursive: true, force: true });
  }
};

test('phase 101: core media library upload/list/delete flow works in admin shell', async () => {
  await withInstallAndMediaState(async () => {
    markInstalled({ version: '101.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
    const server = createHttpServer({
      runtime: bootstrap.runtime,
      config: bootstrap.config,
      startupTimestamp: '2026-01-01T00:00:00.000Z',
      port: 0,
      rootDirectory: cwd
    });

    const { port } = await server.start();

    try {
      const uploadForm = new FormData();
      uploadForm.set('file', new Blob(['hello media'], { type: 'text/plain' }), 'hello.txt');

      const uploadResponse = await fetch(`http://127.0.0.1:${port}/admin/media/upload`, {
        method: 'POST',
        body: uploadForm,
        redirect: 'manual'
      });

      assert.equal(uploadResponse.status, 302);
      assert.equal(uploadResponse.headers.get('location'), '/admin/media');

      const mediaState = JSON.parse(fs.readFileSync(MEDIA_STATE_PATH, 'utf8')) as { media: Array<Record<string, unknown>> };
      assert.equal(Array.isArray(mediaState.media), true);
      assert.equal(mediaState.media.length, 1);
      const record = mediaState.media[0] ?? {};
      assert.equal(record.filename, 'hello.txt');
      assert.equal(typeof record.id, 'string');
      assert.equal(typeof record.storagePath, 'string');

      const storedFilePath = path.join(UPLOADS_DIR, path.basename(`${record.storagePath ?? ''}`));
      assert.equal(fs.existsSync(storedFilePath), true);
      assert.equal(fs.readFileSync(storedFilePath, 'utf8'), 'hello media');

      const listResponse = await fetch(`http://127.0.0.1:${port}/admin/media`);
      assert.equal(listResponse.status, 200);
      const listHtml = await listResponse.text();
      assert.equal(listHtml.includes('<aside class="admin-sidebar">'), true);
      assert.equal(listHtml.includes('<main class="admin-main">'), true);
      assert.equal(listHtml.includes('<h1>Media library</h1>'), true);
      assert.equal(listHtml.includes('hello.txt'), true);
      assert.equal(listHtml.includes('<a href="/admin/media" aria-current="page" class="is-active">Media</a>'), true);

      const uploadPageResponse = await fetch(`http://127.0.0.1:${port}/admin/media/upload`);
      assert.equal(uploadPageResponse.status, 200);
      const uploadPageHtml = await uploadPageResponse.text();
      assert.equal(uploadPageHtml.includes('enctype="multipart/form-data"'), true);

      const mediaFileResponse = await fetch(`http://127.0.0.1:${port}${record.storagePath}`);
      assert.equal(mediaFileResponse.status, 200);
      assert.equal(await mediaFileResponse.text(), 'hello media');

      const deleteResponse = await fetch(`http://127.0.0.1:${port}/admin/media/${encodeURIComponent(`${record.id}`)}/delete`, {
        method: 'POST',
        redirect: 'manual'
      });
      assert.equal(deleteResponse.status, 302);

      const afterDeleteState = JSON.parse(fs.readFileSync(MEDIA_STATE_PATH, 'utf8')) as { media: Array<Record<string, unknown>> };
      assert.equal(afterDeleteState.media.length, 0);
      assert.equal(fs.existsSync(storedFilePath), false);
    } finally {
      await server.stop();
    }
  });
});
