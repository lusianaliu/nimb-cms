# Phase 197 — Final Compact Writable-Directory Text Fragment Alignment

## Summary

Phase 197 adopts one final compact writable-directory overlap with real drift payoff:

- shared assembly of preflight `next` text that combines invariant remediation with the canonical `(Path: <directory>)` suffix.

This stays intentionally narrow. It does **not** centralize all writable-directory phrasing.

## Final fragment decision

Chosen fragment:

- `<remediation> (Path: <directory>)`

Why this fragment:

- It remained repeated in multiple active preflight writable-directory branches after Phase 196.
- The wording intent is stable and operator-visible.
- It can be shared without changing branch taxonomy or branch-specific detail text.

Implemented helper:

- `formatDirectoryRemediationWithPathSuffix(remediation, directoryPath)` in `core/invariants/directory-writability.ts`.

## Adoption changes

Preflight adoption in `evaluateRequiredDirectory` now reuses `formatDirectoryRemediationWithPathSuffix(...)` for:

- `required-directory-writable` fail branch
- `required-directory-parent` unresolved-parent fail branch
- `required-directory-missing` writable-parent warn branch

The parent-not-writable branch remains local because it intentionally carries a richer combined annotation:

- `(Path: <directory>; Parent: <parent-path>)`

## Consistency impact

This reduces one more concrete source of drift in operator-facing writable-directory guidance while preserving:

- current startup behavior
- preflight envelope and control flow
- invariant taxonomy and branch-local messaging where context differs

## Remaining local text (intentional)

The following remain local by design:

- branch-specific detail sentences (`missing`, `shape`, `unresolved-parent`, `parent-not-writable`)
- combined parent-aware suffix assembly for the parent-not-writable branch
- startup throw-control flow and runtime probing behavior

These local areas encode branch context and are not good candidates for further micro-extractions unless a new repeated fragment shows clear payoff.

## Diminishing-returns note

With Phase 197, the writable-directory micro-hardening track is near-complete for low-risk text-fragment alignment.

Further tiny extractions should be avoided unless they remove a clearly repeated operator-visible fragment with measurable drift risk. The safer direction is returning to higher-impact product milestones.
