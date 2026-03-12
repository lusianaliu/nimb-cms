# Phase 157 — Minimal Theme Selection Write Path

## Scope

Phase 157 adds one canonical write path for selecting the active public theme.
It extends the existing runtime theme service and admin API path from Phase 156.

This phase intentionally does **not** add a visual theme picker, installer, or marketplace flow.

## Canonical write path

The active public theme is updated through:

- `PUT /admin-api/system/themes`

Expected payload:

- `themeId` (string)

The route delegates to the runtime theme boundary:

- `runtime.themes.setConfiguredThemeId(themeId)`

## Validation behavior

Theme writes are validated against registered themes before saving:

- non-string `themeId` → `400 INVALID_THEME_ID`
- blank/whitespace `themeId` → `400 THEME_ID_REQUIRED`
- unknown theme id not present in registry → `400 UNKNOWN_THEME_ID`
- already active theme id → no-op write; returns current status

Only valid, registered theme ids are persisted.

## Settings and persistence behavior

`settings.theme` remains the sole active-theme selector.

On successful validation, the canonical settings path persists the change:

- `runtime.settings.updateSettings({ theme: themeId })`

This keeps disk persistence in `data/settings.json` and runtime cache behavior unchanged.

## Read/write coherence with runtime.themes

The write endpoint returns the same status shape used by read operations:

- `configuredThemeId`
- `resolvedThemeId`
- `defaultThemeId`
- `fallbackApplied`
- `themes`

After a successful write:

- `runtime.themes.getConfiguredThemeId()` reflects the saved `settings.theme`
- `runtime.themes.getResolvedThemeId()` reflects fallback-aware resolution

Public rendering continues to resolve the active theme through the same selector path,
so there is no competing source of truth.

## Future-facing note

This phase provides minimal, validated write readiness for a future non-technical admin theme selector UX.

Still intentionally unsupported in this phase:

- full theme manager UI
- previews/comparisons
- remote install/marketplace/distribution
