# Phase 189 — Next Compact Overlap Cluster Adoption

Phase 189 continues the selective startup/preflight invariant-registry adoption path with one compact overlap cluster only.

## Overlap cluster chosen

This phase adopts the **admin staticDir fail-detail wording** overlap cluster for the already-registry-backed `admin-static-dir` invariant.

Why this cluster:

- startup and preflight both validate `admin.staticDir` when admin is enabled
- shared id/title/why/remediation were already in the invariant registry
- remaining drift risk was in local fail-detail literals for “missing” and “not a directory” branches
- a tiny helper can align wording without changing any startup/preflight control flow

## Shared helper added

Added `core/invariants/admin-static-dir.ts` with:

- `ADMIN_STATIC_DIR_INVARIANT` (registry-backed export)
- `formatAdminStaticDirInvariantFailure(detail)`

The helper standardizes canonical startup-style invariant failure text:

- `Startup invariant failed [admin-static-dir]: <detail>`

## Adoption changes

### Startup adoption (`core/bootstrap/startup-invariants.ts`)

`validateAdminStaticDir` now formats both configured failure branches through the shared helper:

- configured `admin.staticDir` path missing
- configured `admin.staticDir` path exists but is not a directory

Behavior is preserved:

- admin-disabled path still skips validation
- default unresolved fallback path still does not hard-fail when unset
- configured invalid paths still throw startup blockers

### Preflight adoption (`core/cli/preflight.ts`)

Preflight now reuses the same canonical helper text for admin staticDir **FAIL** detail branches:

- `admin-static-dir-shape`
- `admin-static-configured-missing`

Behavior intentionally kept local:

- PASS/WARN/FAIL envelope and summary
- default staticDir missing remains WARN (`admin-static-fallback`) with local contextual guidance
- local finding codes and branch-specific `next` text composition

## What remains local (intentionally)

Phase 189 remains selective. The following areas intentionally remain local:

- default admin static fallback warning copy (preflight-only operator context)
- admin static path resolution details (`runtimeRoot` join behavior)
- startup throw control flow and preflight finding assembly

These branches are context-heavy enough that forcing further centralization here would create churn with limited payoff.

## Tests

`test/phase183-invariant-registry.test.ts` adds Phase 189 coverage for:

- helper canonical formatting
- startup admin staticDir throw detail parity through helper reuse
- preflight configured admin staticDir fail-detail parity through helper reuse

## Incremental scope note

Phase 189 intentionally centralizes one compact overlap cluster only. It further reduces startup/preflight drift risk for admin staticDir failure wording while preserving current architecture and execution models.
