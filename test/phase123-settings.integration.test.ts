import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './helpers/create-installed-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase123-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);
};

test('phase 123: settings load, update, and persist via admin settings API', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { server, port } = await createInstalledServer({ cwd });

  try {
    const initialResponse = await fetch(`http://127.0.0.1:${port}/admin-api/settings`);
    assert.equal(initialResponse.status, 200);

    const initial = await initialResponse.json();
    assert.equal(initial.siteName, 'My Nimb Site');
    assert.equal(initial.tagline, 'Just another Nimb site');
    assert.equal(typeof initial.homepageIntro, 'string');
    assert.equal(initial.footerText, '');
    assert.equal(initial.theme, 'default');

    const updatePayload = {
      siteName: 'Phase 123 Site',
      tagline: 'Configurable runtime settings',
      homepageIntro: 'Welcome to the Phase 123 company website.',
      footerText: '© Phase 123 Company',
      timezone: 'America/New_York',
      theme: 'default'
    };

    const updateResponse = await fetch(`http://127.0.0.1:${port}/admin-api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    assert.equal(updateResponse.status, 200);

    const updated = await updateResponse.json();
    assert.equal(updated.siteName, 'Phase 123 Site');
    assert.equal(updated.tagline, 'Configurable runtime settings');
    assert.equal(updated.homepageIntro, 'Welcome to the Phase 123 company website.');
    assert.equal(updated.footerText, '© Phase 123 Company');
    assert.equal(updated.timezone, 'America/New_York');

    const persistedPath = path.join(cwd, 'data', 'settings.json');
    assert.equal(fs.existsSync(persistedPath), true);

    const persisted = JSON.parse(fs.readFileSync(persistedPath, 'utf8'));
    assert.equal(persisted.siteName, 'Phase 123 Site');
    assert.equal(persisted.tagline, 'Configurable runtime settings');
    assert.equal(persisted.homepageIntro, 'Welcome to the Phase 123 company website.');
    assert.equal(persisted.footerText, '© Phase 123 Company');
    assert.equal(persisted.timezone, 'America/New_York');

  } finally {
    await server.stop();
  }
});
