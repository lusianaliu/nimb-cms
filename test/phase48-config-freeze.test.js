import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../core/bootstrap/runtime-factory.ts';

const config = Object.freeze({
  name: 'nimb-app',
  plugins: Object.freeze([]),
  runtime: Object.freeze({ logLevel: 'info', mode: 'development' }),
  server: Object.freeze({ port: 0 }),
  admin: Object.freeze({ enabled: true, basePath: '/admin', staticDir: './ui/admin', title: 'Nimb Admin' })
});

test('phase 48: runtime.getConfig returns immutable config snapshot', () => {
  const runtime = createRuntime(config);
  runtime.setConfig({
    name: 'nimb-app',
    runtime: { mode: 'development', logLevel: 'info' },
    admin: { enabled: true, basePath: '/admin', staticDir: './ui/admin', title: 'Nimb Admin' }
  });

  const snapshot = runtime.getConfig();

  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.runtime), true);

  assert.throws(() => {
    snapshot.runtime.mode = 'production';
  }, /Cannot assign to read only property/);
});
