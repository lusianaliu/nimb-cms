import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { isInstalled, markInstalled } from '../core/setup/setup-state.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase75-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}
`);
};

const systemConfigPath = (cwd: string) => path.join(cwd, 'data', 'system', 'config.json');

test('phase 75: missing install marker selects install mode by default', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  fs.rmSync(systemConfigPath(cwd), { force: true });

  const bootstrap = await createBootstrap({ cwd });

  assert.equal((bootstrap.runtime as { mode?: string }).mode, 'install');
});

test('phase 75: existing install marker selects runtime mode by default', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  markInstalled({ version: '75.0.0', projectRoot: cwd });

  const bootstrap = await createBootstrap({ cwd });

  assert.equal((bootstrap.runtime as { mode?: string }).mode, 'runtime');
});

test('phase 75: markInstalled creates valid system config install state', async () => {
  const cwd = mkdtemp();
  fs.rmSync(systemConfigPath(cwd), { force: true });

  const installState = markInstalled({ version: '75.1.0', projectRoot: cwd });
  const persisted = JSON.parse(fs.readFileSync(systemConfigPath(cwd), 'utf8'));

  assert.equal(isInstalled({ projectRoot: cwd }), true);
  assert.equal(typeof persisted.installedAt, 'string');
  assert.equal(Number.isNaN(Date.parse(persisted.installedAt)), false);
  assert.equal(persisted.version, '75.1.0');
  assert.equal(persisted.installed, true);
  assert.deepEqual(persisted, installState);
});
