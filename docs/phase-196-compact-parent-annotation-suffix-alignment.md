# Phase 196 — Compact Parent Annotation Suffix Alignment

## Summary

This phase adopts one additional compact writable-directory `next`-text overlap by centralizing the parent annotation fragment:

- `Parent: <parent-path>`

The branch taxonomy, finding envelopes, and control flow remain local in preflight/startup paths.

## What changed

- Added `formatDirectoryNextParentAnnotation(parentPath)` in `core/invariants/directory-writability.ts`.
- Updated preflight writable-directory `required-directory-parent` (parent-not-writable branch) to use the shared parent annotation formatter when building:
  - `(Path: ...; Parent: ...)`

## What remains local (intentionally)

This phase is intentionally narrow and does **not** centralize all writable-directory messaging.
The following remain local by design:

- full branch-specific `next` sentence assembly,
- preflight finding envelope fields (`code`, `check`, severity, `why`),
- branch selection/control flow and taxonomy (`missing`, `shape`, `parent-not-writable`, `unresolved-parent`, etc.),
- startup throw behavior.

## Why this is incremental and low-risk

The extracted helper centralizes only a stable operator-visible suffix fragment (`Parent: ...`) already repeated in active-path writable-directory diagnostics.
This reduces drift risk for parent annotations while preserving existing architecture and behavior.
