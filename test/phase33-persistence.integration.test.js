import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase33-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
};

const read = (cwd, key) => fs.readFileSync(path.join(cwd, '.nimb', `${key}.json`), 'utf8');

test('phase 33: persistence saves runtime sections', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  const bootstrap = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });

  assert.equal(bootstrap.inspector.persistence().storageHealth, 'ok');
  assert.deepEqual(bootstrap.inspector.persistence().storedKeys, ['goals', 'orchestrator', 'runtime']);

  assert.ok(fs.existsSync(path.join(cwd, '.nimb', 'runtime.json')));
  assert.ok(fs.existsSync(path.join(cwd, '.nimb', 'goals.json')));
  assert.ok(fs.existsSync(path.join(cwd, '.nimb', 'orchestrator.json')));
});

test('phase 33: restart restores state before runtime lifecycle', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });
  const restarted = await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });

  const persisted = JSON.parse(read(cwd, 'runtime'));
  assert.equal(restarted.runtime.getRestoredState().snapshotId, persisted.payload.snapshotId);
  assert.equal(Object.isFrozen(restarted.runtime.getRestoredState()), true);
});

test('phase 33: repeated writes are deterministic', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, { name: 'nimb-app', plugins: [], runtime: { logLevel: 'info', mode: 'development' } });

  await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });

  const firstRuntime = read(cwd, 'runtime');
  const firstGoals = read(cwd, 'goals');
  const firstOrchestrator = read(cwd, 'orchestrator');

  await createBootstrap({ cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' });

  assert.equal(read(cwd, 'runtime'), firstRuntime);
  assert.equal(read(cwd, 'goals'), firstGoals);
  assert.equal(read(cwd, 'orchestrator'), firstOrchestrator);
});
