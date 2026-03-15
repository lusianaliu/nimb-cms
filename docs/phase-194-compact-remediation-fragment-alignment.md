# Phase 194 — Compact Remediation Fragment Alignment

Phase 194 adopts one narrow operator-remediation wording overlap in the shared startup/preflight invariant registry.

## Chosen compact fragment

This phase aligns the shared writable-directory remediation fallback phrase:

- `or choose a writable project root.`

The fragment now comes from a tiny helper:

- `formatWritableDirectoryRemediation(scope)` in `core/invariants/remediation-fragments.ts`

## What changed

- Added `formatWritableDirectoryRemediation(scope)` to centralize one stable wording fragment used by writable-directory invariants.
- Updated these shared invariant metadata entries to use the helper:
  - `data-directory-writable`
  - `persistence-directory-writable`
  - `logs-directory-writable`
- Added tests that verify:
  - helper output for the compact phrase,
  - metadata adoption for all three writable-directory invariants.

## Why this is intentionally small

This phase does **not** centralize all preflight `next` text or all startup failure text.
It only centralizes one stable remediation fragment in shared metadata that already feeds operator guidance.

## What remains local

The following remain local by design in this phase:

- branch envelopes and taxonomy (`required-directory-writable`, `required-directory-parent`, `required-directory-missing`),
- branch-specific path annotations in preflight `next` fields,
- startup throw/catch control flow and detail envelopes.

These areas still carry some wording drift risk, but broader migration would require a larger refactor than intended for this compact phase.
