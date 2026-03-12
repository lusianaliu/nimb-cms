# Phase 162 — Theme Microcopy & Edge-State Polish

Phase 162 refines wording on `/admin/settings` so unusual theme states are clearer for non-technical admins.
This is a polish pass only; no new theme capability or architecture was added.

## What was polished

Theme microcopy was updated across the existing selector-adjacent surfaces:

- selector helper and coverage hint text
- active/saved theme state line
- diagnostics summary and rows
- already-active (no-op) save message
- fallback-applied and unavailable-status messages

The tone now favors short, calm wording and avoids technical phrasing where possible.

## Edge states now expressed more clearly

The admin theme flow now uses gentler language for these edge states:

- **coverage unknown/unavailable**: shown as coverage details being unavailable right now
- **theme status load failure**: framed as temporary unavailability while the site keeps its current theme
- **full-theme fallback active**: phrased as Nimb using the default theme when the saved theme cannot be fully used
- **incomplete/partial theme**: explained as some pages using default theme templates
- **already-active selection**: explicit no-op confirmation that no changes were made

## Consistency across selector, status, and diagnostics

Terminology was aligned around:

- “core pages/templates” for completeness guidance
- “default theme” for fallback outcomes
- “coverage details are not available right now” for uncertain/unavailable metadata

This keeps selector hints, status lines, and diagnostics messages in a coherent voice.

## Canonical API coherence preserved

No new data source or parallel status interpretation path was introduced.
The page continues to use canonical metadata from `GET /admin-api/system/themes` and existing write behavior via `PUT /admin-api/system/themes`.

`settings.theme` remains the sole active-theme selector.

## Intentional non-goals kept

Phase 162 does not add:

- theme gallery/cards
- previews/screenshots/live preview
- install/upload/marketplace flows
- new theme engines or pluginization of themes
