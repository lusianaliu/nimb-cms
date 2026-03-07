import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer } from './helpers/create-test-server.ts';
import { loadSystemConfig } from '../core/system/system-config.ts';
import { existsSync } from 'node:fs';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase106-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

test('phase 106: install flow transitions runtime and persists installed state', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const first = await createTestServer({ cwd });
  const firstStart = await first.server.start();

  try {
    const beforeInstall = await fetch(`http://127.0.0.1:${firstStart.port}/`, { redirect: 'manual' });
    assert.equal(beforeInstall.status, 302);
    assert.equal(beforeInstall.headers.get('location'), '/install');

    const installPage = await fetch(`http://127.0.0.1:${firstStart.port}/install`, { redirect: 'manual' });
    assert.equal(installPage.status, 200);
    assert.equal(installPage.headers.get('content-type'), 'text/html; charset=utf-8');

    const installResponse = await fetch(`http://127.0.0.1:${firstStart.port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        adminEmail: 'admin@example.com',
        adminPassword: 'super-secret-password',
        siteName: 'My Site'
      }),
      redirect: 'manual'
    });
    assert.equal(installResponse.status, 302);
    assert.equal(installResponse.headers.get('location'), '/admin');

    const systemConfig = loadSystemConfig({ projectRoot: cwd, runtimeVersion: '0.1.0' });
    assert.equal(systemConfig.installed, true);
    assert.equal(typeof systemConfig.version, 'string');
    assert.equal(Number.isNaN(Date.parse(systemConfig.installedAt ?? '')), false);
    assert.equal(existsSync(path.join(cwd, 'data', 'install.lock')), true);

    const installAfter = await fetch(`http://127.0.0.1:${firstStart.port}/install`, { redirect: 'manual' });
    assert.equal(installAfter.status, 404);
  } finally {
    await first.server.stop();
  }

  const second = await createTestServer({ cwd });
  const secondStart = await second.server.start();

  try {
    assert.equal(second.runtime.system.installed, true);

    const rootAfterRestart = await fetch(`http://127.0.0.1:${secondStart.port}/`, { redirect: 'manual' });
    assert.equal(rootAfterRestart.status, 200);
    assert.equal(rootAfterRestart.headers.get('content-type'), 'text/html; charset=utf-8');
  } finally {
    await second.server.stop();
  }
});
