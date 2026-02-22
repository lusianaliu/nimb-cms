# Phase 26 — Runtime Policy Engine

This phase introduces a deterministic runtime policy layer that evaluates execution behavior before sandbox lifecycle execution.

## Module Layout

- `core/runtime/policy/policy-engine.ts`
- `core/runtime/policy/policy-context.ts`
- `core/runtime/policy/policy-evaluator.ts`
- `core/runtime/policy/policy-snapshot.ts`
- `core/runtime/policy/index.ts`

## Inputs

Policy evaluation consumes:

- topology snapshot
- health snapshot
- routing decision
- version resolution snapshot

## Decisions

Each evaluation returns a frozen decision with:

- `allowExecution`: allow/deny lifecycle execution
- `degradedMode`: degraded mode activation
- `fallback.enforced`: fallback enforcement signal
- `retryStrategy`: selected strategy (`immediate-once`, `exponential-backoff`, `none`)
- `reasons`: deterministic blocked reasons

## Runtime Integration

`PluginRuntime` now evaluates policy in `activatePlugin` before `SandboxRunner.executeLifecycle(...)`.

If execution is blocked, lifecycle activation fails fast with a policy-blocked error.

## Inspector API

`runtime.getInspector().policy()` returns policy evaluations snapshot.

## Diagnostics

Policy evaluation emits:

- `policy:evaluated`
- `policy:blocked`
- `policy:degraded`

## Determinism

Policy evaluation is deterministic for identical inputs:

- no random inputs
- sorted reason list
- immutable snapshots and decisions
