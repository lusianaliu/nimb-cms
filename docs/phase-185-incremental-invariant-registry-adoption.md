# Phase 185 — Incremental Invariant Registry Adoption (Next Overlap Set)

Phase 185 continues the incremental startup/preflight invariant-registry adoption pattern from Phases 183–184 without changing architecture.

## Audit outcome: next overlap set

After Phase 184, the next small high-value overlap set was:

1. `admin-static-dir` severity intent in preflight (`WARN` for default fallback missing, `FAIL` for configured path missing/non-directory)
2. `install-state-config-json` severity intent in preflight (`WARN` for missing/invalid JSON, `FAIL` for wrong path shape)
3. startup-port invariant id usage in preflight's startup-parity port probe error text

These checks were selected because startup and preflight already share intent and wording, and centralizing severity/id usage reduces drift risk with low churn.

## Changes in this phase

### Preflight adoption

`core/cli/preflight.ts` now uses shared invariant metadata more directly for this overlap set:

- uses `startup-port` shared invariant id when emitting startup-parity port probe errors
- derives admin static-dir `FAIL`/`WARN` severity from `admin-static-dir.severityIntent.preflight`
- derives install-state `FAIL`/`WARN` severity from `install-state-config-json.severityIntent.preflight`

Preflight still keeps local mechanics for report formatting, per-branch codes, and contextual details.

### Startup behavior

No startup execution-model changes were made in this phase. Startup invariants remain in `core/bootstrap/startup-invariants.ts` with existing behavior.

## What remains intentionally local

The following stay local by design in Phase 185:

- project-root and config-resolution diagnostics (preflight-only operational context)
- expected-layout checks for `plugins/`, `themes/`, `public/` (not startup blockers)
- path/detail text that depends on exact preflight branch context
- required-directory probing flow (`required-directory-*` finding code granularity)

Migration remains selective to avoid forcing context-heavy checks into metadata-only registry entries.

## Drift-risk impact

Phase 185 reduces startup/preflight drift risk further by centralizing one more layer of shared operator-facing intent:

- invariant id consistency for startup-port probe parity text
- severity intent consistency for admin static-dir and install-state findings

This keeps the registry useful while avoiding overreach into a generic validation framework.
