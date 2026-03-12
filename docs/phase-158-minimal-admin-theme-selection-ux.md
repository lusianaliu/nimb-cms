# Phase 158 — Minimal Admin Theme Selection UX

## Scope

Phase 158 adds a small, non-technical admin control for switching the active public theme.
It reuses the canonical theme status/read and validated write APIs introduced in earlier phases.

This phase intentionally does **not** add previews, galleries, installation flows, or a marketplace.

## Admin settings UX changes

Theme selection now appears as a dedicated **Public theme** section on `/admin/settings`.

The section provides:

- a simple dropdown populated from `GET /admin-api/system/themes`
- a separate **Save theme** action for explicit, low-risk theme updates
- an active state note that distinguishes configured theme vs resolved active theme
- fallback wording when the configured theme cannot be resolved and default is active

The existing settings form for site identity/basic settings remains intact and minimal.

## Canonical API usage

The admin UX uses only canonical theme routes:

- read status/list: `GET /admin-api/system/themes`
- write selection: `PUT /admin-api/system/themes` with `{ "themeId": "..." }`

No parallel theme mutation path was introduced.
`settings.theme` remains the sole selector persisted through runtime settings.

## Fallback visibility

Fallback behavior is surfaced in human-readable status text:

- configured theme id is shown
- resolved active theme is shown
- if fallback is active, the UI explicitly says default fallback is active

This helps non-technical admins understand when a saved id does not resolve to the active runtime theme.

## Feedback and safety

The theme control now includes short messages for:

- loading theme state
- successful save
- failed save with a useful message from API validation when available
- unavailable theme API/load failures

The settings form still saves general settings separately, avoiding accidental theme changes.

## Still intentionally unsupported

Phase 158 continues to leave these out by design:

- visual theme gallery/cards
- live preview
- screenshot-driven selection
- remote install/upload/marketplace flows
- advanced theme customization UI
