import test from 'node:test';
import assert from 'node:assert/strict';
import { GoalEvaluator, GoalEngine, RuntimeGoalType } from '../core/runtime/goals/index.ts';
import { PluginRuntime } from '../core/runtime/plugin-runtime/lifecycle-runner.ts';
import { RuntimeIntentType } from '../core/runtime/orchestrator/index.ts';

const runtimeStateWithHealth = (plugins = [], nodes = []) => Object.freeze({
  state: Object.freeze({
    healthSnapshot: Object.freeze({ plugins: Object.freeze(plugins) }),
    topologySnapshot: Object.freeze({ nodes: Object.freeze(nodes) })
  })
});

test('phase 31: goal evaluation remains stable for identical snapshots', () => {
  const evaluator = new GoalEvaluator();
  const goal = Object.freeze({
    goalId: 'goal-stable-active',
    type: RuntimeGoalType.ENSURE_PLUGIN_ACTIVE,
    target: Object.freeze({ pluginId: 'alpha' }),
    desiredCondition: Object.freeze({ state: 'active' }),
    evaluationStrategy: 'strict',
    metadata: Object.freeze({})
  });

  const snapshots = Object.freeze({
    runtimeStateSnapshot: runtimeStateWithHealth([{ pluginId: 'alpha', status: 'healthy' }]),
    reconcilerSnapshot: Object.freeze({ stable: true, drift: Object.freeze([]), actions: Object.freeze([]) }),
    schedulerSnapshot: Object.freeze({ executed: Object.freeze([{ pluginId: 'alpha', status: 'success' }]) })
  });

  const first = evaluator.evaluate(goal, snapshots);
  const second = evaluator.evaluate(goal, snapshots);

  assert.deepEqual(first, second);
  assert.equal(first.satisfied, true);
  assert.equal(first.requiredIntent.length, 0);
});

test('phase 31: drift detection yields deterministic runtime intents', () => {
  const evaluator = new GoalEvaluator();
  const goal = Object.freeze({
    goalId: 'goal-restart-unhealthy',
    type: RuntimeGoalType.ENSURE_PLUGIN_HEALTHY,
    target: Object.freeze({ pluginId: 'beta' }),
    desiredCondition: Object.freeze({ status: 'healthy' }),
    evaluationStrategy: 'strict',
    metadata: Object.freeze({})
  });

  const decision = evaluator.evaluate(goal, {
    runtimeStateSnapshot: runtimeStateWithHealth([{ pluginId: 'beta', status: 'degraded' }]),
    reconcilerSnapshot: Object.freeze({ stable: false, drift: Object.freeze([{ pluginId: 'beta', reason: 'plugin-unhealthy' }]), actions: Object.freeze([]) }),
    schedulerSnapshot: Object.freeze({ executed: Object.freeze([]) })
  });

  assert.equal(decision.satisfied, false);
  assert.equal(decision.violated, true);
  assert.equal(decision.requiredIntent[0].type, RuntimeIntentType.RESTART_PLUGIN);
  assert.equal(decision.requiredIntent[0].intentId, 'goal:goal-restart-unhealthy:restart:beta');
});

test('phase 31: goal engine emits intents in deterministic order and integrates with orchestrator', async () => {
  const runtime = new PluginRuntime({ loader: { discover: async () => [] } });
  runtime.registerGoals([
    {
      goalId: 'goal-z-runtime-stable',
      type: RuntimeGoalType.ENSURE_RUNTIME_STABLE,
      target: {},
      desiredCondition: { stable: true },
      evaluationStrategy: 'strict'
    },
    {
      goalId: 'goal-a-active-alpha',
      type: RuntimeGoalType.ENSURE_PLUGIN_ACTIVE,
      target: { pluginId: 'alpha' },
      desiredCondition: { state: 'active' },
      evaluationStrategy: 'strict'
    }
  ]);

  runtime.reconciler.lastSnapshot = Object.freeze({
    cycle: 1,
    stable: false,
    drift: Object.freeze([{ pluginId: 'alpha', reason: 'missing-activation' }]),
    actions: Object.freeze([{ type: 'schedule-plugin', pluginId: 'alpha' }])
  });

  const snapshot = await runtime.goalEngine.evaluateCycle();

  assert.deepEqual(snapshot.activeGoals.map((goal) => goal.goalId), ['goal-a-active-alpha', 'goal-z-runtime-stable']);
  assert.deepEqual(snapshot.emittedIntents.map((intent) => intent.intentId), [
    'goal:goal-a-active-alpha:activate:alpha',
    'goal:goal-z-runtime-stable:stabilize'
  ]);

  const orchestratorSnapshot = runtime.getInspector().orchestrator();
  assert.deepEqual(orchestratorSnapshot.lastPlans.map((entry) => entry.intentId), [
    'goal:goal-a-active-alpha:activate:alpha',
    'goal:goal-z-runtime-stable:stabilize'
  ]);
});

test('phase 31: inspector exposes deterministic goals snapshot and defaults', async () => {
  const runtime = new PluginRuntime({ loader: { discover: async () => [] } });
  const emptyA = runtime.getInspector().goals();
  const emptyB = runtime.getInspector().goals();

  assert.deepEqual(emptyA, emptyB);
  assert.deepEqual(emptyA, {
    activeGoals: [],
    evaluationResults: [],
    emittedIntents: []
  });

  runtime.registerGoal({
    goalId: 'goal-capability',
    type: RuntimeGoalType.ENSURE_CAPABILITY_AVAILABLE,
    target: { capability: 'content:read' },
    desiredCondition: { available: true },
    evaluationStrategy: 'strict'
  });

  await runtime.goalEngine.evaluateCycle();

  const goalsSnapshot = runtime.getInspector().goals();
  assert.equal(goalsSnapshot.activeGoals.length, 1);
  assert.equal(goalsSnapshot.evaluationResults.length, 1);
  assert.equal(goalsSnapshot.evaluationResults[0].goalId, 'goal-capability');
});
