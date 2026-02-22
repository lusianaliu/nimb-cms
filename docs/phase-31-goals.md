# Phase 31 — Runtime Goal Engine

Phase 31 adds a deterministic Goal Engine layer above the Intent Orchestrator. It continuously evaluates declared runtime goals against current runtime snapshots and emits runtime intents when desired conditions drift.

## Goal vs intent

- **Goal**: a persistent declaration of desired runtime reality.
- **Intent**: an actionable orchestration request generated from goal drift.

Flow:

1. Goal is registered in `GoalEngine`.
2. `GoalEvaluator` compares snapshots against goal conditions.
3. Violations produce deterministic `requiredIntent` entries.
4. `GoalEngine` emits intents through `runtime.intent()`.
5. Existing orchestrator/scheduler pipeline handles execution.

## Goal model

`RuntimeGoal` fields are deterministic and serializable:

- `goalId`
- `type`
- `target`
- `desiredCondition`
- `evaluationStrategy`
- `metadata`

Supported goal types:

- `ENSURE_PLUGIN_ACTIVE`
- `ENSURE_PLUGIN_HEALTHY`
- `ENSURE_CAPABILITY_AVAILABLE`
- `ENSURE_RUNTIME_STABLE`

## Evaluation lifecycle

1. Reconciliation cycle completes.
2. Runtime triggers `goalEngine.evaluateCycle()`.
3. Evaluator reads:
   - `RuntimeStateSnapshot`
   - `ReconcilerSnapshot`
   - `SchedulerSnapshot`
4. Decisions are recorded in immutable `GoalSnapshot`:
   - `activeGoals`
   - `evaluationResults`
   - `emittedIntents`
5. Inspector exposes this via `runtime.getInspector().goals()`.

## Determinism guarantees

- Identical snapshots and goal set produce identical decisions.
- Goals are stored and evaluated in stable `goalId` order.
- Emitted intents are sorted by deterministic `intentId`.
- Goal payload normalization uses stable key ordering.
- No random values are introduced.
- No timestamps are emitted within goal decisions or intents (snapshot boundaries may include time externally).

## Runtime autonomy model

The Goal Engine improves autonomy by continuously closing drift loops:

- Reconciler detects runtime drift.
- Goal evaluator interprets drift against declared outcomes.
- Orchestrator receives deterministic intents and schedules corrective work.

This separation keeps policy/actuation unchanged while adding a reusable declarative control layer.
