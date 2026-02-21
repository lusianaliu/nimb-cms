import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { PluginRuntime } from '../../core/runtime/plugin-runtime/lifecycle-runner.ts';
import { RuntimeContracts } from '../../src/core/plugins/runtime-contracts.js';

class CapturingLogger {
  constructor() {
    this.events = [];
  }

  info(message, metadata = {}) {
    this.events.push({ level: 'info', message, metadata });
  }

  warn(message, metadata = {}) {
    this.events.push({ level: 'warn', message, metadata });
  }

  error(message, metadata = {}) {
    this.events.push({ level: 'error', message, metadata });
  }
}

test('comment-basic plugin is auto-discovered, activated, and safely unloaded through runtime contracts', async () => {
  const previousToggle = process.env.NIMB_ENABLE_COMMENT_BASIC;
  process.env.NIMB_ENABLE_COMMENT_BASIC = 'true';

  const logger = new CapturingLogger();
  const runtimeContracts = new RuntimeContracts({ logger });
  const runtime = new PluginRuntime({
    pluginsDirectory: path.resolve(process.cwd(), 'plugins'),
    contracts: runtimeContracts.createContractSurface(),
    logger
  });

  const records = await runtime.start();
  const commentBasic = records.find((record) => record.id === 'comment-basic');

  assert.ok(commentBasic, 'comment-basic descriptor should be discovered');
  assert.equal(commentBasic.state, 'active', 'comment-basic should activate successfully');

  assert.ok(runtimeContracts.capabilities.has('comment:create'));
  assert.ok(runtimeContracts.capabilities.has('comment:read'));
  assert.ok(runtimeContracts.capabilities.has('comment:update'));
  assert.ok(runtimeContracts.capabilities.has('comment:delete'));

  assert.ok(runtimeContracts.schemas.has('comment-basic.comment'));

  const hookNames = Array.from(runtimeContracts.lifecycleHooks.values())
    .filter((hook) => hook.source === '@nimblabs/plugin-comment-basic')
    .map((hook) => hook.name)
    .sort();

  assert.deepEqual(hookNames, ['afterCommentPublish', 'beforeCommentSave', 'onCommentCreate']);

  const unloaded = await runtime.unload('comment-basic');
  assert.equal(unloaded, true);

  assert.equal(runtimeContracts.capabilities.has('comment:create'), false);
  assert.equal(runtimeContracts.capabilities.has('comment:read'), false);
  assert.equal(runtimeContracts.capabilities.has('comment:update'), false);
  assert.equal(runtimeContracts.capabilities.has('comment:delete'), false);
  assert.equal(runtimeContracts.schemas.has('comment-basic.comment'), false);

  const remainingCommentHooks = Array.from(runtimeContracts.lifecycleHooks.values()).filter(
    (hook) => hook.source === '@nimblabs/plugin-comment-basic'
  );
  assert.equal(remainingCommentHooks.length, 0);

  const unloadEvent = logger.events.find(
    (event) => event.level === 'info' && event.message === 'plugin.runtime.unload' && event.metadata.plugin === 'comment-basic'
  );
  assert.ok(unloadEvent, 'runtime should emit unload event for comment-basic');

  await runtime.unloadAll();

  if (previousToggle === undefined) {
    delete process.env.NIMB_ENABLE_COMMENT_BASIC;
  } else {
    process.env.NIMB_ENABLE_COMMENT_BASIC = previousToggle;
  }
});
