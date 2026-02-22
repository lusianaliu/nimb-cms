import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap, loadConfig } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase32-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
};

test('phase 32: config loads deterministically', () => {
  const cwd = mkdtemp();
  writeConfig(cwd, {
    name: 'nimb-app',
    plugins: ['zeta', 'alpha', 'alpha'],
    runtime: { logLevel: 'INFO', mode: 'development' }
  });

  const first = loadConfig({ cwd });
  const second = loadConfig({ cwd });

  assert.deepEqual(first, second);
  assert.deepEqual(first.plugins, ['alpha', 'zeta']);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.runtime), true);
});

test('phase 32: runtime starts and bootstrap snapshot is immutable', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, {
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  });

  const startupTimestamp = '2026-01-01T00:00:00.000Z';
  const bootstrap = await createBootstrap({ cwd, startupTimestamp });

  assert.ok(bootstrap.runtime);
  assert.equal(bootstrap.snapshot.startupTimestamp, startupTimestamp);
  assert.equal(Object.isFrozen(bootstrap.snapshot), true);
  assert.equal(Object.isFrozen(bootstrap.snapshot.loadedPlugins), true);

  assert.throws(() => {
    bootstrap.snapshot.runtimeStatus = 'mutated';
  }, TypeError);
});

test('phase 32: repeated bootstrap produces same structure with fixed timestamp', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, {
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  });

  const options = { cwd, startupTimestamp: '2026-01-01T00:00:00.000Z' };
  const first = await createBootstrap(options);
  const second = await createBootstrap(options);

  assert.deepEqual(first.snapshot, second.snapshot);
  assert.deepEqual(first.inspector.bootstrap(), second.inspector.bootstrap());
});

test('phase 32: missing config falls back to deterministic defaults', () => {
  const cwd = mkdtemp();
  const config = loadConfig({ cwd });

  assert.deepEqual(config, {
    name: 'nimb-app',
    plugins: [],
    runtime: {
      logLevel: 'info',
      mode: 'development'
    }
  });
});
