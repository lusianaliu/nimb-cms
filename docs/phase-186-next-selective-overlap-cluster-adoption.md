# Phase 186 — Next Selective Overlap Cluster Adoption

Phase 186 continues the incremental startup/preflight invariant-registry adoption path from Phases 183–185 with one additional compact overlap cluster.

## Overlap cluster chosen

This phase adopts the **startup-port parsing + invariant-failure wording** overlap cluster:

- canonical port validation for `PORT` and `config.server.port`
- canonical startup-invariant failure string format for startup-port failures

Why this cluster was chosen:

- startup and preflight both already enforce the same startup-port operator intent
- the cluster is stable, high-value, and low-risk
- drift remained in local invalid-port wording (`Invalid PORT environment variable` vs startup invariant wording)

## What changed

### Shared startup-port helper module

Added `core/invariants/startup-port.ts` with:

- `STARTUP_PORT_INVARIANT` (registry-backed entry reuse)
- `formatStartupPortInvariantFailure(detail)`
- `assertValidStartupPort(port, sourceLabel)`

This keeps the registry metadata lightweight while centralizing the most drift-prone startup-port failure text.

### Startup adoption

`core/bootstrap/startup-invariants.ts` now reuses the startup-port helper for:

- invalid-port validation
- unavailable-port failure formatting
- port-check failure formatting

Startup behavior is preserved (same failure conditions and control flow), with wording consistency improved.

### Preflight adoption

`core/cli/preflight.ts` now reuses the startup-port helper for:

- parsing/validating env and config startup-port values
- startup-port probe failure formatting

Preflight behavior is preserved (same FAIL outcome for invalid/unavailable startup port), while the detail text is now canonical startup-invariant text.

### CLI startup-path adoption

`bin/nimb.js` now reuses `assertValidStartupPort` for `resolvePort`, reducing drift between direct startup parsing and preflight parsing for invalid-port diagnostics.

## What remains local (intentionally)

Still local in this phase:

- preflight finding envelope (`code`, PASS/WARN/FAIL rendering, summary/exit code)
- context-specific preflight `next` guidance composition
- startup control flow and throw sites beyond startup-port-specific formatter reuse
- other invariant clusters not selected for this phase

Rationale: these areas still include command-specific behavior and branch-local details where forced centralization would add churn.

## Tests added/updated

`test/phase183-invariant-registry.test.ts` now also verifies Phase 186 startup-port overlap adoption by covering:

- shared startup-port helper canonical failure text
- preflight startup-port invalid detail text parity using canonical invariant wording

## Incremental scope statement

Phase 186 is deliberately selective: one compact overlap cluster only. It improves startup/preflight drift resistance without changing architecture, execution models, or broad validation structure.
