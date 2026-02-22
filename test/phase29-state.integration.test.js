import test from 'node:test';
import assert from 'node:assert/strict';
import { StateProjector, RuntimeStateSnapshot } from '../core/runtime/state/index.ts';
import { PluginRuntime } from '../core/runtime/plugin-runtime/lifecycle-runner.ts';
import { RuntimeInspector } from '../core/runtime/observability/index.ts';

test('phase 29: projection is stable across runs with identical input snapshots', () => {
  const providers = {
    topologyProvider: () => Object.freeze({
      nodes: Object.freeze([{ pluginId: 'beta' }, { pluginId: 'alpha' }]),
      edges: Object.freeze([]),
      activationOrder: Object.freeze(['alpha', 'beta']),
      unresolvedDependencies: Object.freeze([])
    }),
    healthProvider: () => Object.freeze({
      plugins: Object.freeze([{ pluginId: 'alpha', status: 'healthy' }, { pluginId: 'beta', status: 'healthy' }]),
      failures: Object.freeze([]),
      recoveryActions: Object.freeze([]),
      degradedCapabilities: Object.freeze([])
    }),
    policyProvider: () => Object.freeze({ evaluations: Object.freeze([]) }),
    schedulerProvider: () => Object.freeze({ queue: Object.freeze([]), executed: Object.freeze([]), skipped: Object.freeze([]), plans: Object.freeze([]) }),
    reconcilerProvider: () => Object.freeze({ cycle: 1, stable: true, drift: Object.freeze([]), actions: Object.freeze([]) })
  };

  const first = new StateProjector({ ...providers, clock: () => '2026-01-01T00:00:00.000Z' }).project();
  const second = new StateProjector({ ...providers, clock: () => '2026-01-01T00:00:00.000Z' }).project();

  assert.deepEqual(first, second);
  assert.equal(first.snapshotId, second.snapshotId);
});

test('phase 29: deterministic derived status includes scheduler and reconciler pending corrections', () => {
  const snapshot = new StateProjector({
    clock: () => '2026-01-01T00:00:00.000Z',
    topologyProvider: () => ({
      nodes: [{ pluginId: 'alpha' }, { pluginId: 'beta' }],
      edges: [],
      activationOrder: ['alpha', 'beta'],
      unresolvedDependencies: []
    }),
    healthProvider: () => ({
      plugins: [{ pluginId: 'alpha', status: 'healthy' }, { pluginId: 'beta', status: 'degraded' }],
      failures: [],
      recoveryActions: [],
      degradedCapabilities: []
    }),
    policyProvider: () => ({ evaluations: [] }),
    schedulerProvider: () => ({ queue: [{ pluginId: 'beta', stage: 'register' }], executed: [], skipped: [], plans: [] }),
    reconcilerProvider: () => ({ cycle: 2, stable: false, drift: [], actions: [{ pluginId: 'beta', type: 'restart-plugin' }] })
  }).project();

  assert.deepEqual(snapshot.state.derivedStatus, {
    systemHealthy: false,
    degraded: true,
    pendingCorrections: 2,
    activePlugins: 2
  });
});

test('phase 29: runtime state snapshots are deeply immutable', () => {
  const snapshot = RuntimeStateSnapshot.from({
    createdAt: '2026-01-01T00:00:00.000Z',
    state: {
      topologySnapshot: { nodes: [{ pluginId: 'alpha' }], edges: [], activationOrder: ['alpha'], unresolvedDependencies: [] },
      healthSnapshot: { plugins: [], failures: [], recoveryActions: [], degradedCapabilities: [] },
      policySnapshot: { evaluations: [] },
      schedulerSnapshot: { queue: [], executed: [], skipped: [], plans: [] },
      reconcilerSnapshot: { cycle: 0, stable: true, drift: [], actions: [] },
      derivedStatus: { systemHealthy: true, degraded: false, pendingCorrections: 0, activePlugins: 1 }
    }
  });

  assert.throws(() => {
    snapshot.state.topologySnapshot.nodes.push({ pluginId: 'beta' });
  }, TypeError);
});

test('phase 29: missing subsystem providers produce deterministic empty snapshot', () => {
  const first = new StateProjector({ clock: () => '1970-01-01T00:00:00.000Z' }).project();
  const second = new RuntimeInspector().state();

  assert.equal(first.state.derivedStatus.systemHealthy, true);
  assert.equal(first.state.derivedStatus.activePlugins, 0);
  assert.equal(second.snapshotId, RuntimeStateSnapshot.empty().snapshotId);
});

test('phase 29: plugin runtime exposes state projection via runtime and inspector APIs', () => {
  const runtime = new PluginRuntime({
    loader: { discover: async () => [] },
    stateProjector: new StateProjector({
      clock: () => '2026-01-01T00:00:00.000Z',
      topologyProvider: () => ({ nodes: [], edges: [], activationOrder: ['alpha'], unresolvedDependencies: [] }),
      healthProvider: () => ({ plugins: [{ pluginId: 'alpha', status: 'healthy' }], failures: [], recoveryActions: [], degradedCapabilities: [] }),
      policyProvider: () => ({ evaluations: [] }),
      schedulerProvider: () => ({ queue: [{ pluginId: 'alpha' }], executed: [], skipped: [], plans: [] }),
      reconcilerProvider: () => ({ cycle: 4, stable: false, drift: [{ pluginId: 'alpha', reason: 'missing-activation' }], actions: [{ pluginId: 'alpha', type: 'schedule-plugin' }] })
    })
  });

  const state = runtime.getState();
  const inspectorState = runtime.getInspector().state();

  assert.deepEqual(state, inspectorState);
  assert.equal(state.state.reconcilerSnapshot.actions.length, 1);
  assert.equal(state.state.schedulerSnapshot.queue.length, 1);
});
