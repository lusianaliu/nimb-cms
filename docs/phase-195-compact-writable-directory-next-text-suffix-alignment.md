# Phase 195 — Compact Writable-Directory Next-Text Suffix Alignment

## Summary

Phase 195 aligns one compact writable-directory `next`-text suffix overlap by centralizing the canonical path annotation fragment:

- `(Path: <directory>)`

This keeps writable-directory branch taxonomy, envelopes, and control flow local, while reducing startup/preflight wording drift for path suffix formatting.

## What changed

- Added `formatDirectoryNextPathSuffix(directoryPath)` in `core/invariants/directory-writability.ts`.
- Updated writable-directory preflight branches that used the repeated `(Path: ...)` suffix to reuse the shared helper.
  - unresolved parent branch
  - missing-with-writable-parent branch
  - directory-not-writable branch

## What remains local (intentionally)

The following remain local in this phase to avoid overreach:

- Parent-specific suffix assembly such as `(Path: ...; Parent: ...)`
- Full branch-specific sentence assembly for `next` text
- Startup throw/catch control flow and preflight finding envelopes
- Branch taxonomy distinctions (`required-directory-writable`, `required-directory-parent`, `required-directory-missing`)

This keeps migration incremental and low-risk while still hardening one repeated operator-facing fragment.

## Why this is incremental and safe

- No execution model changes in startup or preflight.
- No invariant taxonomy changes.
- No broad template system introduced.
- Only one compact suffix fragment was centralized.
