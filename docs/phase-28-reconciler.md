# Phase 28 — Runtime Reconciliation Loop

Phase 28 adds a deterministic reconciliation loop that aligns runtime state with desired system state after scheduler cycles.

## Module

`core/runtime/reconciler/` introduces:

- `reconciler.ts`: observes snapshots and produces deterministic drift + correction plans.
- `reconcile-plan.ts`: normalizes and orders correction actions.
- `reconcile-loop.ts`: runs the reconciler after scheduler cycles and feeds corrective actions into the scheduler.
- `reconcile-snapshot.ts`: immutable inspector-facing state.
- `index.ts`: module exports.

## Inputs used for reconciliation

- topology snapshot
- health monitor snapshot
- scheduler snapshot
- policy snapshot

## Responsibilities implemented

- Observe runtime snapshots each reconciliation cycle.
- Detect drift between desired activation topology and actual execution/health state.
- Trigger scheduler corrections for restart, re-schedule, and invalid topology removal actions.
- Restart failed plugins deterministically through runtime recovery callbacks.
- Remove invalid topology nodes based on unresolved dependencies.

## Deterministic guarantees

For identical inputs, action ordering is stable:

1. Ordered by `pluginId`.
2. Then ordered by action type priority:
   - `remove-topology-node`
   - `restart-plugin`
   - `schedule-plugin`

## Runtime integration

The plugin runtime now runs reconciliation after scheduler lifecycle execution and feeds corrective plans back into the same scheduler queue.

Inspector API surface now includes:

- `runtime.getInspector().reconciler()`

## Diagnostics

The loop emits:

- `reconciler:drift-detected`
- `reconciler:corrected`
- `reconciler:stable`

## Test coverage

- Drift detection
- Auto-recovery correction enqueue/execution
- Deterministic correction ordering for identical state
