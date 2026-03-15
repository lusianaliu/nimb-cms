# Phase 190 — Next Compact Overlap Cluster Adoption

Phase 190 continues selective startup/preflight invariant adoption with one compact overlap cluster only.

## Overlap cluster chosen

This phase adopts the **required-directory shape fail-detail wording** cluster for existing writable-directory invariants:

- `data-directory-writable`
- `persistence-directory-writable`
- `logs-directory-writable`

Why this cluster:

- startup and preflight both encounter the same operator reality when expected directories resolve to non-directory filesystem entries
- prior phases already aligned writable-failure detail text, but shape-failure detail remained local in preflight and partially local in startup internals
- a tiny helper can align canonical failure text with minimal code churn

## Shared helper extension

Extended `core/invariants/directory-writability.ts` with:

- `formatDirectoryShapeInvariantFailure(invariant, label, directoryPath)`

The helper standardizes startup-style invariant text for this shape branch:

- `Startup invariant failed [<id>]: <label> path is not a directory: <path>`

## Adoption changes

### Startup adoption (`core/bootstrap/startup-invariants.ts`)

Directory probe internals now accept the active invariant and use shared shape-failure formatting before local higher-level handling continues.

Behavior is preserved:

- startup still treats writability/shape failures as blockers
- higher-level public throw text for existing writable checks remains unchanged
- control flow and bootstrap architecture remain intact

### Preflight adoption (`core/cli/preflight.ts`)

`required-directory-shape` findings now:

- reuse invariant fail severity intent via `invariantFailSeverity(...)`
- reuse `formatDirectoryShapeInvariantFailure(...)` for detail text

Behavior intentionally kept local:

- finding code taxonomy and check labels
- preflight-only next-step guidance text
- parent-path and missing-directory branch diagnostics

## What remains local (intentionally)

Phase 190 still leaves some directory diagnostics local:

- preflight `required-directory-parent` and `required-directory-missing` branch detail wording
- startup’s catch-and-rethrow public wording for top-level writable checks
- branch-specific `next` guidance composition

These branches remain context-heavy enough that broader centralization would add churn relative to value in this phase.

## Tests

`test/phase183-invariant-registry.test.ts` adds Phase 190 coverage for:

- `formatDirectoryShapeInvariantFailure(...)` canonical formatting
- preflight `required-directory-shape` severity/detail reuse via the shared helper

## Incremental scope note

Phase 190 adopts one compact overlap cluster only. It reduces startup/preflight drift risk for directory shape failures while preserving the active startup/preflight execution models and overall architecture.
