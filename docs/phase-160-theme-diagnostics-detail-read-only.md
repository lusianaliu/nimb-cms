# Phase 160 — Theme Diagnostics Detail (Read-Only)

Phase 160 adds a small, read-only diagnostics detail area to the existing **Public theme** section on `/admin/settings`.
The goal is to improve transparency for non-technical admins without introducing a diagnostics console or new theme engine.

## What changed

The settings page now includes a compact expandable diagnostics block:

- `Theme diagnostics` summary text that reflects completeness/fallback state
- a short diagnostics list explaining configured vs resolved runtime theme state
- missing canonical template names (when available)
- clear fallback wording that distinguishes:
  - full-theme fallback (`fallbackApplied`)
  - per-template fallback for incomplete themes (`missingTemplates`)

This is read-only UI detail only. Theme selection still uses the same save flow.

## Diagnostics details now visible

Admins can now inspect:

- configured theme from settings (`configuredThemeId`)
- resolved active theme used by runtime (`resolvedThemeId`)
- whether full-theme fallback is currently active (`fallbackApplied`)
- whether selected theme supports all canonical templates (`supportsAllCanonicalTemplates`)
- which canonical templates are missing (`missingTemplates`) when known

The wording intentionally stays calm and safety-oriented.

## Missing-template visibility

When a selected theme is incomplete and exposes missing template names, the diagnostics section lists those canonical template names directly and explains that missing pages are safely rendered with default fallback templates.

If missing-template detail is unavailable, the UI says so plainly instead of inventing unsupported diagnostics.

## Canonical API coherence

Phase 160 continues to rely only on canonical APIs/boundaries:

- `GET /admin-api/system/themes` for read status and diagnostics metadata
- `PUT /admin-api/system/themes` for validated theme selection writes
- `settings.theme` remains the sole active-theme selector

No second theme resolver, side-channel status source, or plugin-based theme runtime was introduced.

## Intentionally still unsupported

This phase does not add:

- previews/screenshots/gallery cards
- live preview tooling
- install/upload/marketplace flows
- advanced diagnostics console

Those remain future work.
