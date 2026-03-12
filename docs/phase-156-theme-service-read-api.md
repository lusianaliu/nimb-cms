# Phase 156 — Theme Service / Read API

## Scope

Phase 156 adds a small canonical theme read surface on the active runtime path.
It does **not** add a theme switching UI, installer, or marketplace behavior.

## Canonical runtime read surface

Theme read operations are now exposed through `runtime.themes` from:

- `core/theme/theme-service.ts`

`runtime.themes` provides:

- `list()`
- `getConfiguredThemeId()`
- `getResolvedThemeId()`
- `getActive()`
- `getStatus()`

## Metadata shape

Theme metadata returned by `runtime.themes.list()` is intentionally lightweight and safe:

- `id`
- `title`
- `source`
- `isDefault`
- `templates` (canonical template names available)

Template renderer function handles are not exposed through this read API.

## Active theme visibility

`settings.theme` remains the sole configured selector.

The read surface now clearly distinguishes:

- configured theme id (`settings.theme`)
- resolved theme id (with fallback to `default` when configured id is not registered)

`getActive()` and `getStatus()` expose both ids plus `fallbackApplied`.

## Read-only admin/API access path

A minimal admin read endpoint is available:

- `GET /admin-api/system/themes`

It returns `runtime.themes.getStatus()` data for admin/status consumers.

## What remains out of scope

- No full theme manager UI
- No remote install/marketplace flow
- No settings redesign beyond preserving `settings.theme` as source-of-truth

This keeps the phase low-risk while preparing canonical theme selection UX work in later phases.
