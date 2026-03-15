# Phase 191 — Directory Parent Failure Overlap Adoption

Phase 191 adopts one additional compact overlap branch in directory diagnostics: preflight required-directory parent-path writability failures.

## Overlap branch chosen

Chosen branch:

- preflight `required-directory-parent` when a required directory is missing and the nearest existing parent path is not writable.

Why this branch:

- It is a small, stable overlap point within existing required-directory diagnostics.
- It is operator-facing wording that can drift over time if kept as local inline strings.
- It can reuse existing canonical invariant detail formatting without changing startup/preflight control flow.

## Shared helper extension

Extended `core/invariants/directory-writability.ts` with narrow helpers for the parent-path branch:

- `resolveNearestExistingPath(targetPath)`
- `formatDirectoryParentNotWritableDetail(directoryPath, nearestExistingPath)`
- `formatDirectoryParentNotWritableInvariantFailure(invariant, directoryPath, nearestExistingPath)`

Scope is intentionally tight: this is not a generic directory diagnostics framework.

## Adoption changes

### Preflight adoption (`core/cli/preflight.ts`)

- Reused shared `resolveNearestExistingPath(...)` instead of a local copy.
- Updated `required-directory-parent` (parent not writable branch) detail text to use `formatDirectoryParentNotWritableInvariantFailure(...)`.

Preserved local behavior:

- preflight finding envelope (`code`, `check`, `why`, `next`)
- branch control flow and taxonomy (`required-directory-parent` vs `required-directory-missing`)
- unresolved-parent branch wording (`Unable to resolve an existing parent path...`) remains local.

### Startup behavior

- No startup control-flow changes in this phase.
- Startup directory writability checks remain as currently implemented.

This is intentional: startup does not currently expose a distinct required-directory-parent branch, so broader centralization here would be speculative.

## What remains local (intentionally)

Still local after Phase 191:

- preflight unresolved-parent wording (`required-directory-parent` where no existing ancestor can be resolved)
- preflight missing-directory-on-writable-parent wording (`required-directory-missing`)
- startup catch-and-rethrow top-level writability summary text
- preflight branch-specific `next` composition

These remain context-heavy and not yet a clean one-branch overlap target without broader refactor churn.

## Tests

Extended `test/phase183-invariant-registry.test.ts` with Phase 191 coverage for:

- shared parent-not-writable helper canonical formatting
- preflight `required-directory-parent` detail reuse for parent-not-writable branch

## Incremental scope note

Phase 191 continues selective low-risk adoption. It reduces wording drift risk for one additional parent-path branch while preserving current architecture and execution models.
