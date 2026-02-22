# Phase 22 — Runtime Health & Self-Healing System

This phase introduces a runtime-owned health subsystem with deterministic failure handling.
Plugins have no direct access to health control paths.

## Added module

`core/runtime/health/`

- `health-monitor.ts` — central health recorder and recovery executor.
- `failure-classifier.ts` — deterministic category mapping.
- `recovery-planner.ts` — bounded, ordered strategy planner.
- `health-snapshot.ts` — immutable inspector output builder.
- `index.ts` — health exports.

## Failure coverage

Runtime health captures failures from:

- plugin lifecycle activation/unload failures
- capability invocation failures
- event subscriber failures
- state mutation and state subscriber failures

## Failure categories

- `transient`
- `deterministic`
- `dependency failure`
- `contract violation`

## Recovery strategies

The planner emits deterministic strategy lists:

1. retry activation (bounded attempts)
2. isolate plugin
3. disable capability provider
4. dependency cascade stop

## Runtime integration points

Health monitoring is wired into:

- `plugin-runtime/lifecycle-runner.ts`
- `capability-resolver/capability-resolver.ts`
- `event-system/event-system.ts`
- `state-store/state-store.ts`

## Inspector API

`runtime.getInspector().health()` now returns:

- plugin health status
- failure history
- recovery actions
- degraded capability providers

## Diagnostics events

Emitted runtime diagnostics events:

- `health:failure`
- `health:recovery`
- `health:isolation`

## Determinism notes

- Retry attempts are bounded and counted per plugin/source key.
- Dependency cascade stop uses topology edges and stable lexical ordering.
- Recovery strategy order is fixed by planner implementation.
