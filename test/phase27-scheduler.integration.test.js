import test from 'node:test';
import assert from 'node:assert/strict';
import { Scheduler } from '../core/runtime/scheduler/index.ts';
import { DiagnosticsChannel } from '../core/runtime/observability/index.ts';

const allowPolicy = Object.freeze({
  allowExecution: true,
  degradedMode: false,
  retryStrategy: 'none',
  reasons: Object.freeze([])
});

const createScheduler = () => new Scheduler({
  diagnosticsChannel: new DiagnosticsChannel(),
  topologyProvider: () => Object.freeze({
    activationOrder: Object.freeze(['alpha', 'beta', 'gamma']),
    edges: Object.freeze([])
  }),
  healthProvider: () => Object.freeze({ degradedCapabilities: Object.freeze([]) })
});

test('phase 27: deterministic ordering is preserved for identical scheduler inputs', async () => {
  const run = async () => {
    const scheduler = createScheduler();
    const executed = [];

    scheduler.enqueueLifecycle({ pluginId: 'beta', priority: 3, policyDecision: allowPolicy, operation: () => {} });
    scheduler.enqueueLifecycle({ pluginId: 'alpha', priority: 3, policyDecision: allowPolicy, operation: () => {} });
    scheduler.enqueueLifecycle({ pluginId: 'gamma', priority: 1, policyDecision: allowPolicy, operation: () => {} });

    await scheduler.drain(async (entry) => {
      executed.push(entry.pluginId);
      return { ok: true, value: null };
    });

    return executed;
  };

  const first = await run();
  const second = await run();

  assert.deepEqual(first, second);
  assert.deepEqual(first, ['alpha', 'beta', 'gamma']);
});

test('phase 27: retry scheduling requeues failed execution based on policy strategy', async () => {
  const scheduler = new Scheduler({
    topologyProvider: () => Object.freeze({ activationOrder: Object.freeze(['retry-plugin']), edges: Object.freeze([]) }),
    healthProvider: () => Object.freeze({ degradedCapabilities: Object.freeze(['content:render']) })
  });

  scheduler.enqueueLifecycle({
    pluginId: 'retry-plugin',
    capability: 'content:render',
    policyDecision: Object.freeze({
      allowExecution: true,
      degradedMode: true,
      retryStrategy: 'immediate-once',
      reasons: Object.freeze([])
    }),
    operation: () => {}
  });

  let attempts = 0;
  await scheduler.drain(async () => {
    attempts += 1;
    if (attempts === 1) {
      return { ok: false, error: new Error('first attempt failed') };
    }

    return { ok: true, value: 'ok' };
  });

  const snapshot = scheduler.snapshot();
  assert.equal(attempts, 2);
  assert.equal(snapshot.executed.filter((entry) => entry.pluginId === 'retry-plugin').length, 2);
  assert.equal(snapshot.executed.some((entry) => entry.pluginId === 'retry-plugin' && entry.attempt === 1 && entry.status === 'success'), true);
});

test('phase 27: dependency-aware scheduling delays execution until dependencies complete', async () => {
  const scheduler = new Scheduler({
    topologyProvider: () => Object.freeze({
      activationOrder: Object.freeze(['alpha', 'beta']),
      edges: Object.freeze([{ from: 'beta', to: 'alpha' }])
    })
  });

  scheduler.enqueueLifecycle({ pluginId: 'beta', dependencies: ['alpha'], priority: 10, policyDecision: allowPolicy, operation: () => {} });
  scheduler.enqueueLifecycle({ pluginId: 'alpha', priority: 1, policyDecision: allowPolicy, operation: () => {} });

  const order = [];
  await scheduler.drain(async (entry) => {
    order.push(entry.pluginId);
    return { ok: true, value: null };
  });

  assert.deepEqual(order, ['alpha', 'beta']);
});
