# Phase 29: Runtime State Projection

Phase 29 adds a deterministic Runtime State Projection layer that composes subsystem snapshots into one immutable runtime view.

## Projection purpose

The runtime already emits inspector-safe snapshots for topology, health, policy, scheduler, and reconciler systems. The state projection layer exists to aggregate those subsystem outputs into a single normalized object for diagnostics, inspection, and future orchestration work.

`StateProjector` is intentionally side-effect free:

- It only reads provider snapshots.
- It does not mutate runtime subsystems.
- It produces a new immutable `RuntimeStateSnapshot` each call.

## Snapshot model

The projection returns `RuntimeStateSnapshot` with:

- `version`: snapshot schema version (`v1`)
- `snapshotId`: deterministic identifier derived from canonical state content
- `createdAt`: projection creation boundary timestamp
- `state`: normalized `RuntimeState`

`RuntimeState` includes:

- `timestamp`
- `topologySnapshot`
- `healthSnapshot`
- `policySnapshot`
- `schedulerSnapshot`
- `reconcilerSnapshot`
- `derivedStatus`

`derivedStatus` is deterministic and includes:

- `systemHealthy`
- `degraded`
- `pendingCorrections`
- `activePlugins`

## Inspector usage

The runtime inspector now exposes `state()`:

- `runtime.getState()` builds and returns a `RuntimeStateSnapshot`
- `runtime.getInspector().state()` returns the same projection
- If no state provider exists, inspector returns a deterministic empty snapshot

## Determinism guarantees

The projection layer enforces deterministic output with:

- stable plugin-oriented ordering for normalized entry arrays
- canonical key ordering in serialized snapshot state
- deterministic `snapshotId` hashing from canonical state content
- no randomness
- no `Date.now()` outside the snapshot creation boundary

## Architectural role

This phase creates the runtime's read-model boundary before orchestration phases. It centralizes system visibility without changing runtime lifecycle execution behavior.
