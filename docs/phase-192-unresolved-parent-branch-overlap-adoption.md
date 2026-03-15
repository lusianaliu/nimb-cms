# Phase 192 — Unresolved Parent Branch Overlap Adoption

Phase 192 adopts one additional compact overlap branch in directory diagnostics: preflight `required-directory-parent` unresolved-parent failures.

## Branch chosen

Chosen overlap:
- preflight `required-directory-parent` when a required directory is missing and no existing parent path can be resolved.

Why this branch:
- it is operator-visible and drift-prone wording in the same directory cluster touched by prior phases
- it has a clear canonical invariant id to reuse (`*-directory-writable`)
- it can be centralized with a narrow helper without changing control flow

## What changed

Extended `core/invariants/directory-writability.ts` with two narrow unresolved-parent helpers:
- `formatDirectoryUnresolvedParentDetail(directoryPath)`
- `formatDirectoryUnresolvedParentInvariantFailure(invariant, directoryPath)`

Updated `core/cli/preflight.ts`:
- preflight `required-directory-parent` unresolved-parent detail now uses `formatDirectoryUnresolvedParentInvariantFailure(...)`

This keeps branch control flow local while aligning operator-facing text with canonical invariant formatting used in startup/preflight overlap adoption patterns.

## What remains local (intentional)

Still local after Phase 192:
- preflight branch taxonomy (`required-directory-parent` vs `required-directory-missing`)
- unresolved-parent branch `check` labels and remediation `next` text
- startup-side directory validation flow (no new startup unresolved-parent branch introduced in this phase)
- branch-specific path rendering in preflight envelopes

Reasoning:
- startup currently does not expose a distinct unresolved-parent branch equivalent that would justify broader sharing
- centralizing envelope/control-flow concerns here would be speculative and higher risk than the wording drift being addressed

## Drift-reduction impact

Phase 192 reduces drift risk in one compact area:
- unresolved-parent required-directory failures now share the canonical startup-invariant failure prefix and invariant id formatting
- preflight wording for this branch is now less likely to diverge from the invariant registry contract

This remains a selective, low-risk migration and does not claim full directory-diagnostics centralization.
