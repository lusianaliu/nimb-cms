# Phase 159 — Theme Selection Safety & Fallback Warning Polish

Phase 159 improves the existing canonical theme selection UX for non-technical admins.
It keeps the same read/write boundaries from Phases 156–158 and focuses on safer status and warning language.

## What changed

On `/admin/settings` the **Public theme** section now provides:

- clearer pre-save readiness language for the selected theme
- explicit no-op messaging when the selected theme is already configured
- clearer post-save outcomes for active, fallback, and incomplete theme states
- a dedicated warning line that updates when admins change the selected theme

This is a lightweight safety/status polish, not a UI redesign.

## Pre-save clarity improvements

Before saving, admins now get a specific warning/readiness line that can describe:

- theme is already active (no save needed)
- theme is ready and supports all canonical templates
- selected theme is the default safe fallback theme
- selected theme is incomplete and may use fallback templates on missing pages

## Post-save confidence improvements

After save, messaging now distinguishes:

- **saved and active** (normal success)
- **saved with global default fallback active** (configured theme did not resolve at runtime)
- **saved and active, but incomplete theme uses per-template fallback**
- **already active / no-op** when save is unnecessary

## Fallback and incomplete-theme visibility

The canonical theme status payload now includes theme completeness metadata per theme:

- `missingTemplates`
- `supportsAllCanonicalTemplates`

This allows the settings page to explain per-template fallback risk without creating a second state engine in the UI.

Global fallback visibility remains explicit through existing canonical status fields:

- `configuredThemeId`
- `resolvedThemeId`
- `defaultThemeId`
- `fallbackApplied`

## Canonical API coherence

Phase 159 continues to use only canonical APIs:

- `GET /admin-api/system/themes` for theme status/read
- `PUT /admin-api/system/themes` for validated write

`settings.theme` remains the sole persisted selector.
No parallel mutation path or alternate theme resolver was introduced.

## What remains intentionally unsupported

This phase still does **not** add:

- theme gallery/cards
- live preview studio
- install/upload/marketplace behavior
- advanced theme customization system

These remain future-phase concerns.
