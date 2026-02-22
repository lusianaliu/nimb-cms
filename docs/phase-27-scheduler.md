# Phase 27 — Deterministic Execution Scheduler

This phase introduces a deterministic scheduler between policy evaluation and sandbox execution.

## Module Layout

- `core/runtime/scheduler/scheduler.ts`
- `core/runtime/scheduler/schedule-queue.ts`
- `core/runtime/scheduler/execution-plan.ts`
- `core/runtime/scheduler/scheduler-snapshot.ts`
- `core/runtime/scheduler/index.ts`

## Responsibilities

The scheduler now handles runtime lifecycle orchestration by:

- queueing plugin lifecycle executions
- enforcing deterministic ordering guarantees
- applying priority and dependency ordering
- re-queueing retries from policy retry strategy
- pacing degraded-mode retries

## Inputs

Scheduler decisions combine:

- policy decision (`allowExecution`, `retryStrategy`, `degradedMode`)
- routing-derived dependency provider chain (from runtime capability routing)
- topology activation order/dependency context
- health degraded capability signals

## Determinism

For the same queued inputs, scheduler order remains identical because execution planning uses stable sorting on:

1. `availableAtTick`
2. priority
3. topology-derived dependency order
4. queue sequence
5. plugin id

## Runtime Integration

Activation flow is now:

`PolicyEngine -> Scheduler -> SandboxRunner`

`PluginRuntime.activatePlugin` enqueues lifecycle work in `Scheduler`, then drains through `SandboxRunner.executeLifecycle(...)`.

## Inspector API

Scheduler state is exposed via:

- `runtime.getInspector().scheduler()`

The snapshot includes:

- `queue`
- `executed`
- `skipped`
- `plans`

## Diagnostics

Scheduler emits:

- `scheduler:queued`
- `scheduler:executed`
- `scheduler:skipped`

## Tests

Added phase 27 tests for:

- deterministic ordering
- retry rescheduling
- dependency-aware execution
