# Phase 187 — Next Compact Overlap Cluster Adoption

Phase 187 adopts one additional compact startup/preflight overlap cluster: **persistence runtime invalid-JSON invariant failure text**.

## Overlap cluster chosen

- Cluster: persistence runtime file invalid-JSON failure path (`data/system/runtime.json`).
- Why this cluster:
  - startup and preflight already enforce the same operator intent (invalid JSON is a blocking failure),
  - severity is stable (`FAIL` in startup and preflight),
  - branch behavior differs but canonical failure wording can be shared with a tiny helper.

## What changed

- Added `core/invariants/persistence-runtime-json.ts` to expose:
  - canonical invariant metadata alias (`PERSISTENCE_RUNTIME_JSON_INVARIANT`),
  - shared formatter `formatPersistenceRuntimeJsonInvariantFailure(detail)`.
- Startup now emits persistence runtime invalid-JSON errors through the shared formatter.
- Preflight now uses the same shared formatter for `persistence-runtime-invalid-json` finding detail.

This preserves startup/preflight control flow and branch structure while reducing wording/id drift for this compact path.

## What intentionally remains local

The following remains local by design in this phase:

- startup-only throw/control-flow decisions in `validatePersistenceStorage`,
- preflight-only finding codes/PASS-WARN-FAIL report assembly,
- preflight branch detail text for file shape checks and valid-file PASS outcomes,
- directory/path context messaging that is branch-specific.

These local pieces are context-heavy and not migrated to avoid framework overreach.

## Drift-risk impact

This phase reduces drift risk for one high-value overlap point:

- canonical startup/preflight invalid-JSON wording now shares invariant id + prefix,
- future edits to persistence-runtime invalid-JSON copy only need one helper update.

## Validation coverage

- Added tests for the new shared helper output.
- Added tests to verify preflight invalid-JSON detail now uses the shared canonical formatter.

Migration remains intentionally incremental and selective.
