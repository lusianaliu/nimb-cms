import test from 'node:test';
import assert from 'node:assert/strict';
import { Reconciler, ReconcileLoop } from '../core/runtime/reconciler/index.ts';
import { Scheduler } from '../core/runtime/scheduler/index.ts';
import { DiagnosticsChannel } from '../core/runtime/observability/index.ts';

const allowPolicy = Object.freeze({ allowExecution: true, degradedMode: false, retryStrategy: 'none', reasons: Object.freeze([]) });

test('phase 28: detects runtime drift between desired topology and runtime state', () => {
  const reconciler = new Reconciler({
    topologyProvider: () => Object.freeze({
      activationOrder: Object.freeze(['alpha', 'beta']),
      unresolvedDependencies: Object.freeze([{ pluginId: 'orphan', capability: 'missing:capability' }])
    }),
    healthProvider: () => Object.freeze({
      plugins: Object.freeze([{ pluginId: 'beta', status: 'degraded', failures: 1, lastFailureId: 1 }])
    }),
    schedulerProvider: () => Object.freeze({
      executed: Object.freeze([{ pluginId: 'alpha', status: 'success' }])
    })
  });

  const plan = reconciler.reconcile();
  assert.deepEqual(plan.drift.map((entry) => `${entry.pluginId}:${entry.reason}`), [
    'beta:missing-activation',
    'beta:plugin-unhealthy',
    'orphan:invalid-topology-node'
  ]);
});

test('phase 28: auto recovery enqueues deterministic restart corrections after scheduler cycle', async () => {
  const scheduler = new Scheduler({
    topologyProvider: () => Object.freeze({ activationOrder: Object.freeze(['alpha']), edges: Object.freeze([]) })
  });
  const reconciler = new Reconciler({
    topologyProvider: () => Object.freeze({ activationOrder: Object.freeze(['alpha']), unresolvedDependencies: Object.freeze([]) }),
    healthProvider: () => Object.freeze({ plugins: Object.freeze([{ pluginId: 'alpha', status: 'degraded' }]) }),
    schedulerProvider: () => scheduler.snapshot()
  });

  const actions = [];
  const loop = new ReconcileLoop({ reconciler, scheduler });
  const plan = await loop.runAfterSchedulerCycle({
    policyDecision: allowPolicy,
    executeAction: (action) => {
      actions.push(action.type + ':' + action.pluginId);
      return true;
    }
  });

  assert.deepEqual(plan.actions.map((action) => action.type), ['restart-plugin', 'schedule-plugin']);
  assert.deepEqual(actions, ['restart-plugin:alpha', 'schedule-plugin:alpha']);
});

test('phase 28: identical inputs generate identical correction ordering', () => {
  const run = () => {
    const diagnostics = new DiagnosticsChannel();
    const reconciler = new Reconciler({
      diagnosticsChannel: diagnostics,
      topologyProvider: () => Object.freeze({
        activationOrder: Object.freeze(['gamma', 'beta', 'alpha']),
        unresolvedDependencies: Object.freeze([{ pluginId: 'delta', capability: 'missing' }])
      }),
      healthProvider: () => Object.freeze({
        plugins: Object.freeze([
          { pluginId: 'beta', status: 'degraded' },
          { pluginId: 'alpha', status: 'isolated' }
        ])
      }),
      schedulerProvider: () => Object.freeze({ executed: Object.freeze([]) })
    });

    return reconciler.reconcile().actions.map((entry) => `${entry.pluginId}:${entry.type}`);
  };

  const first = run();
  const second = run();
  assert.deepEqual(first, second);
  assert.deepEqual(first, [
    'alpha:restart-plugin',
    'alpha:schedule-plugin',
    'beta:restart-plugin',
    'beta:schedule-plugin',
    'delta:remove-topology-node',
    'gamma:schedule-plugin'
  ]);
});
