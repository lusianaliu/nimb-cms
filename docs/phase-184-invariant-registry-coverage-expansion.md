# Phase 184 — Invariant Registry Coverage Expansion

Phase 184 extends the shared startup/preflight invariant registry with the next highest-value deployment/runtime checks after Phase 183, while preserving current architecture and execution paths.

## New registry coverage

Shared metadata entries were added in `core/invariants/startup-preflight-invariants.ts` for:

1. `install-state-config-json` (`Install-state source path`)
2. `data-directory-writable` (`Data directory writability`)
3. `persistence-directory-writable` (`Persistence directory writability`)
4. `logs-directory-writable` (`Logs directory writability`)

Each entry defines canonical invariant identity/title, severity intent, why it matters, and remediation guidance.

## Adoption in active paths

### Startup

`core/bootstrap/startup-invariants.ts` now uses shared invariant ids in startup failures for:

- data directory writability
- persistence directory writability
- logs directory writability

Startup behavior is unchanged; this phase only aligns canonical id usage to reduce drift.

### Preflight

`core/cli/preflight.ts` now consumes shared metadata for:

- install-state source path findings (title/why/remediation)
- required writable runtime directory findings (why/remediation)

Preflight still keeps local mechanics (probing, path resolution, and finding code granularity) in place.

## What remains intentionally local

The following remain local in this phase:

- preflight-specific finding codes/formatting (`required-directory-*`, etc.)
- path-specific detail wording and conditional branches that are tied to preflight report readability
- project layout expectations (`plugins`, `themes`, `public`) which are not startup blockers
- config-loading and project-root resolution diagnostics that are not shared startup invariants

This keeps migration low-risk while continuing incremental drift reduction.

## Drift-risk impact

Phase 184 further reduces startup/preflight drift risk in deployment-critical checks by centralizing operator-facing metadata for:

- install-state path integrity guidance
- writable runtime storage guidance across data/persistence/log paths

Future phases can continue incremental migration when startup and preflight behavior clearly overlap and centralization remains low-churn.
