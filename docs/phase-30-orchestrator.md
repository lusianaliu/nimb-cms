# Phase 30 — Runtime Intent Orchestrator

Phase 30 introduces a deterministic orchestration layer that translates high-level runtime intent into explicit scheduler-ready plans.

## Intent model

`RuntimeIntent` is the serializable contract accepted by runtime orchestration:

- `intentId` — deterministic identifier for replay-safe orchestration.
- `type` — one of:
  - `ACTIVATE_PLUGIN`
  - `DEACTIVATE_PLUGIN`
  - `RESTART_PLUGIN`
  - `RECONCILE_RUNTIME`
- `targetPlugins` — sorted unique plugin IDs.
- `desiredState` — stable object payload for future runtime state targets.
- `priority` — numeric scheduling signal.
- `metadata` — stable object payload for orchestration diagnostics.

Normalization enforces stable object key ordering and sorted plugin lists to preserve determinism.

## Orchestration flow

1. `PluginRuntime.intent(intent)` receives high-level intent.
2. `Orchestrator` validates and normalizes into `RuntimeIntent`.
3. `IntentPlanner` computes dependency-aware, deterministic plan steps.
4. Each plan step runs policy pre-check via `PolicyEngine` (planning-time only; no side effects).
5. Plan steps are enqueued in `Scheduler` as lifecycle entries.
6. Diagnostics are emitted for acceptance + planned outputs.

The orchestrator does **not** execute lifecycle operations directly; it only prepares and enqueues deterministic execution units.

## Subsystem interaction

- **PolicyEngine**: pre-checks each planned step and carries `allowExecution` into scheduler queue entries.
- **Scheduler**: accepts orchestrated steps without behavior changes.
- **SandboxRunner**: unchanged; still used by runtime lifecycle execution path.
- **Reconciler**: unchanged; still reads scheduler/runtime signals and can run after orchestration.
- **RuntimeState projection**: unchanged in behavior; orchestration state is exposed through inspector APIs.

## Snapshot + inspector

`OrchestratorSnapshot` is immutable and deterministic:

- `pendingIntents`
- `lastPlans`
- `orchestrationStatus`

Inspector now provides `runtime.getInspector().orchestrator()` and returns a deterministic empty snapshot when orchestrator state is unavailable.

## Determinism guarantees

- Same intent input yields identical normalized intent and plan sequence.
- Planning order is stable by plugin ID and dependency graph traversal.
- Snapshot data is immutable and key-sorted where applicable.
- No random values are generated.
- No timestamps are introduced inside planner outputs (only external runtime snapshot boundaries may contain time).
