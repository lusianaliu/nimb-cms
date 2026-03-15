# Phase 188 — Next Compact Overlap Cluster Adoption

Phase 188 continues the selective startup/preflight invariant-registry adoption path with one compact overlap cluster only.

## Overlap cluster chosen

This phase adopts the **writable-directory invariant failure wording** cluster for the already-registry-backed writable directory invariants:

- `data-directory-writable`
- `persistence-directory-writable`
- `logs-directory-writable`

Why this cluster:

- startup and preflight already express the same operator intent: writable runtime directories are required for safe startup
- ids/severity/why/remediation were already in the shared invariant registry from prior phases
- remaining drift risk was in local startup failure text and preflight fail-detail wording
- a tiny helper can reduce wording drift without changing control flow or architecture

## Shared helper added

Added `core/invariants/directory-writability.ts` with:

- `formatDirectoryWritabilityInvariantFailure(invariant, detail)`

The helper standardizes canonical startup-style invariant failure text:

- `Startup invariant failed [<id>]: <detail>`

## Adoption changes

### Startup adoption (`core/bootstrap/startup-invariants.ts`)

Writable-directory startup throw paths now use the shared helper for:

- data directory writability failure
- persistence directory writability failure
- logs directory writability failure

Startup behavior remains the same (still throws on blockers), but wording source is now shared and less drift-prone.

### Preflight adoption (`core/cli/preflight.ts`)

Preflight `required-directory-writable` **FAIL** findings now reuse the same canonical helper format for detail text.

Preflight keeps local behavior where needed:

- PASS/WARN/FAIL envelope and summary handling
- local codes and branch-specific diagnostics (`required-directory-shape`, parent-path checks)
- context-heavy `next` guidance composition

## What remains local (intentionally)

Phase 188 remains selective. These areas stay local intentionally:

- required-directory shape checks and missing-parent branches (preflight-only context)
- expected layout directory checks (`plugins`, `themes`, `public`)
- startup directory probe internals (`ensureWritableDirectory`, startup logging)

These branches are either preflight-specific or context-heavy enough that centralizing now would add churn with limited value.

## Tests

`test/phase183-invariant-registry.test.ts` adds Phase 188 coverage for:

- helper canonical formatting
- startup writable-directory failure text parity through helper reuse
- preflight writable-directory failure detail parity through helper reuse

## Incremental scope note

Phase 188 intentionally centralizes one compact overlap cluster only. It improves startup/preflight consistency for writable-directory blockers while preserving the active startup/preflight execution models and overall architecture.
