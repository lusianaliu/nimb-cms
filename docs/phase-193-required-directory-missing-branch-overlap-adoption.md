# Phase 193 — Required Directory Missing Branch Overlap Adoption

Phase 193 adopts one additional compact overlap branch in directory diagnostics: preflight `required-directory-missing` when the nearest existing parent path is writable.

## Branch chosen

Chosen overlap:
- preflight `required-directory-missing` when a required runtime directory does not exist yet, but the nearest existing parent path is writable.

Why this branch:
- it is a remaining compact wording overlap in the same required-directory cluster
- startup has matching operator intent: writable parents allow runtime directory creation
- it can be centralized through one narrow detail helper without touching control flow

## What changed

Extended `core/invariants/directory-writability.ts` with one narrow helper:
- `formatDirectoryMissingWithWritableParentDetail(directoryPath, nearestExistingPath)`

Updated `core/cli/preflight.ts`:
- preflight `required-directory-missing` detail now uses `formatDirectoryMissingWithWritableParentDetail(...)`

This preserves preflight branch taxonomy and remediation behavior while reducing wording drift against startup intent that missing required directories are creatable when parent paths are writable.

## What remains local (intentional)

Still local after Phase 193:
- startup missing-directory handling remains inside startup `ensureDirectory(...)` flow with local created/verified logs
- preflight branch envelope fields (`code`, `check`, severity, `next`) remain local
- startup catch-level writable failure wording still summarizes as directory-not-writable without exposing missing-directory branch taxonomy
- unresolved-parent and parent-not-writable branch handling remains separate and branch-specific

Reasoning:
- startup and preflight execution models are intentionally different and already stable
- the compact overlap target here was wording drift only for one missing-directory branch
- broader centralization would increase risk and exceed this phase scope

## Drift-reduction impact

Phase 193 reduces drift risk in one additional compact branch:
- preflight missing-directory detail now uses shared canonical phrasing aligned to startup behavior (directory can be created when parent is writable)
- required-directory diagnostics in preflight now have one less branch-specific freeform sentence likely to diverge

This remains selective and low-risk, not a full centralization of all directory diagnostics.
