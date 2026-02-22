# Phase 25 — Plugin Execution Sandbox

Phase 25 introduces a deterministic sandbox boundary around plugin lifecycle execution.

## Intent

- Isolate plugin lifecycle crashes from the rest of runtime activation.
- Enforce contract-only access by providing immutable sandbox contracts.
- Preserve deterministic plugin activation order and diagnostics ordering.
- Feed sandbox failures into existing health monitoring and recovery planning.

## Runtime Design

`PluginRuntime` now delegates register lifecycle execution to `SandboxRunner`.
The sandbox emits diagnostics events around each execution:

- `sandbox:start`
- `sandbox:error`
- `sandbox:terminated`

Each execution entry captures plugin id, stage, load order, and timestamps in a frozen snapshot.
Inspector access is exposed through `runtime.getInspector().sandbox()`.

## Isolation Rules

- Runtime contracts are deep-cloned and deep-frozen per execution boundary.
- Plugins cannot mutate sandbox contract surfaces.
- Access is constrained to known contract keys.
- A sandbox failure marks only the current plugin as failed and reports lifecycle failure to health monitoring.

## Determinism

- Sandbox execution is awaited in the same activation loop used by topology planning.
- No parallel sandbox execution is introduced.
- Diagnostics and snapshot sequence follow the same deterministic plugin order.

## Recovery Interaction

Sandbox lifecycle failures use the existing health pipeline:

1. lifecycle failure is recorded;
2. recovery strategies are planned;
3. retry/isolation behavior remains deterministic and observable from the health inspector.
