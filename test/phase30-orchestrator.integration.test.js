import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentPlanner, RuntimeIntent, RuntimeIntentType, Orchestrator } from '../core/runtime/orchestrator/index.ts';
import { PolicyEngine } from '../core/runtime/policy/index.ts';
import { Scheduler } from '../core/runtime/scheduler/index.ts';
import { Reconciler } from '../core/runtime/reconciler/index.ts';
import { PluginRuntime } from '../core/runtime/plugin-runtime/lifecycle-runner.ts';

const topologySnapshot = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({ pluginId: 'alpha' }),
    Object.freeze({ pluginId: 'beta' }),
    Object.freeze({ pluginId: 'gamma' })
  ]),
  edges: Object.freeze([
    Object.freeze({ from: 'beta', to: 'alpha', capability: 'a' }),
    Object.freeze({ from: 'gamma', to: 'beta', capability: 'b' })
  ]),
  activationOrder: Object.freeze(['alpha', 'beta', 'gamma'])
});

test('phase 30: deterministic planning produces identical plans for identical intent', () => {
  const planner = new IntentPlanner({
    topologyProvider: () => topologySnapshot,
    policyEngine: new PolicyEngine()
  });

  const intent = RuntimeIntent.from({
    intentId: 'intent-001',
    type: RuntimeIntentType.ACTIVATE_PLUGIN,
    targetPlugins: ['gamma'],
    desiredState: { runtime: 'active' },
    priority: 5,
    metadata: { actor: 'test' }
  });

  const first = planner.plan(intent);
  const second = planner.plan(intent);

  assert.deepEqual(first, second);
  assert.deepEqual(first.map((step) => step.pluginId), ['alpha', 'beta', 'gamma']);
});

test('phase 30: policy blocking is captured in generated and scheduled plan entries', async () => {
  const scheduler = new Scheduler({
    topologyProvider: () => Object.freeze({ activationOrder: Object.freeze(['alpha']), edges: Object.freeze([]) })
  });
  const policyEngine = new PolicyEngine({
    evaluator: {
      evaluate: (context) => ({
        allowExecution: context.pluginId !== 'alpha',
        degradedMode: false,
        fallback: Object.freeze({ enforced: false }),
        retryStrategy: 'none',
        reasons: context.pluginId !== 'alpha' ? Object.freeze([]) : Object.freeze(['blocked-by-test-policy'])
      })
    }
  });

  const orchestrator = new Orchestrator({
    scheduler,
    policyEngine,
    topologyProvider: () => Object.freeze({
      nodes: Object.freeze([{ pluginId: 'alpha' }]),
      edges: Object.freeze([]),
      activationOrder: Object.freeze(['alpha'])
    })
  });

  const result = await orchestrator.intent({
    intentId: 'intent-blocked',
    type: RuntimeIntentType.ACTIVATE_PLUGIN,
    targetPlugins: ['alpha']
  });

  assert.equal(result.steps[0].policyDecision.allowExecution, false);

  await scheduler.drain(async () => ({ ok: true, value: null }));
  const snapshot = scheduler.snapshot();
  assert.equal(snapshot.skipped.length, 1);
  assert.deepEqual(snapshot.skipped[0].reasons, ['blocked-by-test-policy']);
});

test('phase 30: runtime orchestrator enqueues scheduler plans and remains reconciler-compatible', async () => {
  const scheduler = new Scheduler({
    topologyProvider: () => Object.freeze({ activationOrder: Object.freeze(['alpha']), edges: Object.freeze([]) })
  });
  const runtime = new PluginRuntime({
    loader: { discover: async () => [] },
    scheduler,
    reconciler: new Reconciler({
      topologyProvider: () => Object.freeze({ activationOrder: Object.freeze(['alpha']), unresolvedDependencies: Object.freeze([]) }),
      healthProvider: () => Object.freeze({ plugins: Object.freeze([]) }),
      schedulerProvider: () => scheduler.snapshot()
    })
  });

  const response = await runtime.intent({
    intentId: 'intent-runtime-001',
    type: RuntimeIntentType.ACTIVATE_PLUGIN,
    targetPlugins: ['alpha'],
    priority: 2
  });

  assert.equal(response.steps.length, 1);
  assert.equal(runtime.getInspector().scheduler().queue.length, 1);

  const reconcilePlan = runtime.reconciler.reconcile();
  assert.equal(Array.isArray(reconcilePlan.actions), true);
});

test('phase 30: inspector returns deterministic orchestrator snapshot including empty defaults', async () => {
  const emptyRuntime = new PluginRuntime({ loader: { discover: async () => [] } });
  const emptyFirst = emptyRuntime.getInspector().orchestrator();
  const emptySecond = emptyRuntime.getInspector().orchestrator();
  assert.deepEqual(emptyFirst, emptySecond);
  assert.equal(emptyFirst.orchestrationStatus.state, 'idle');

  const runtime = new PluginRuntime({ loader: { discover: async () => [] } });
  await runtime.intent({
    intentId: 'intent-inspector-001',
    type: RuntimeIntentType.RECONCILE_RUNTIME,
    targetPlugins: []
  });

  const snapshotA = runtime.getInspector().orchestrator();
  const snapshotB = runtime.getInspector().orchestrator();

  assert.deepEqual(snapshotA, snapshotB);
  assert.equal(snapshotA.lastPlans.length, 1);
  assert.equal(snapshotA.lastPlans[0].intentId, 'intent-inspector-001');
});
