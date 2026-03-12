# Phase 161 — Theme Coverage Hints in Admin Selector

Phase 161 adds small, read-only coverage hints directly around the existing **Public theme** selector on `/admin/settings`.
The goal is to help non-technical admins understand theme completeness earlier, before they need to open diagnostics.

## What changed near the selector

The selector now shows concise at-a-glance cues in two places:

- each theme option includes a short coverage tag:
  - `Complete`
  - `Incomplete`
  - `Default fallback`
- a dedicated helper line under the selector (`Coverage hint: ...`) summarizes the currently selected theme.

This stays intentionally lightweight and does not introduce a gallery or preview UI.

## How hints are derived

Coverage hints are grounded in canonical metadata from `GET /admin-api/system/themes` only:

- `supportsAllCanonicalTemplates`
- `missingTemplates`
- `fallbackApplied`
- configured vs resolved theme ids

No parallel completeness computation source was introduced.

## Relationship to diagnostics

Selector hints are intentionally summarized and non-technical.
Detailed diagnostics from Phase 160 remain the deeper read-only inspection surface.

- selector hints provide quick readiness guidance
- diagnostics continue to provide expanded configured/resolved and missing-template detail

Both are driven from the same canonical payload so they stay coherent.

## Intentional scope limits

Phase 161 still does **not** add:

- theme cards/galleries
- screenshots/previews
- live preview tooling
- install/upload/marketplace flows
- advanced theme management workflows

`settings.theme` remains the sole persisted active-theme selector.
