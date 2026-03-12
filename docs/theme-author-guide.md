# Theme Author Guide (Canonical Public Theme Path)

This guide describes the active Nimb CMS public theme contract used by the canonical runtime path.

## Active path (canonical)

- Entrypoint: `bin/nimb.js`
- Bootstrap wiring: `core/bootstrap/createBootstrap` via `core/bootstrap/bootstrap.ts`
- Public router owner: `core/http/public-router.ts`
- Active public renderer: `runtime.themeRenderer` from `core/theme/theme-renderer.ts`
- Canonical registration/discovery boundary: `core/theme/theme-registry.ts`
- Canonical runtime theme read surface: `runtime.themes` from `core/theme/theme-service.ts`
- Built-in canonical themes: `themes/default/index.ts`, `themes/sunrise/index.ts`

`core/theme/theme-manager.ts` and `core/render/public-renderer.ts` exist but are not the active public route rendering path for the current runtime.

## Theme location and active-theme selection

At this phase, built-in public themes live under:

- `themes/<theme-id>/index.ts`

Built-in theme registration/discovery is centralized in:

- `core/theme/theme-registry.ts`
- `listBuiltinPublicThemes()` for discovery metadata
- `getBuiltinPublicThemeRecord()` for renderer consumption

Active public theme source-of-truth is:

- `runtime.settings.getSettings().theme`
- backed by `core/system/settings.ts` (`theme` field in `SiteSettings`)
- default value: `default`

This means Nimb now dynamically selects the active theme from one canonical setting key (`theme`) on the active renderer path.

Configured vs resolved is now explicit on the runtime read surface:

- `runtime.themes.getConfiguredThemeId()` returns the raw configured `settings.theme` value (normalized for empty input).
- `runtime.themes.getResolvedThemeId()` returns the effective theme id after fallback to `default` if needed.
- `runtime.themes.getActive()` / `runtime.themes.getStatus()` expose both values plus `fallbackApplied`.

## Canonical template names

Use these canonical names in all new code:

- `homepage`
- `page`
- `post-list`
- `post-page`
- `not-found`

Legacy aliases are preserved for compatibility only:

- `index`/`home` -> `homepage`
- `blog`/`blog-list` -> `post-list`
- `post`/`blog-single` -> `post-page`

Unknown names safely fall back to `page`.

## Required template contract and fallback behavior

A valid theme module should export renderers for all canonical template names as:

- `Record<CanonicalThemeTemplateName, (context: ThemeTemplateContext) => string>`

Core fallback behavior in `core/theme/theme-renderer.ts` (using registry helpers from `core/theme/theme-registry.ts`):

- If configured `settings.theme` is missing/unregistered, renderer logs a warning and falls back to `default` theme.
- If selected theme exists but is missing one or more canonical templates, renderer logs warnings and falls back per missing template to the default theme template for that template name.
- Alias resolution and unknown-template fallback remain active (`alias -> canonical`, unknown -> `page`).

This keeps public rendering deterministic and safe while allowing dynamic selection.

## Theme template context contract

Themes receive a normalized `ThemeTemplateContext` object from `core/theme/theme-contract.ts`.

Stable fields:

- `siteName: string`
- `siteTagline: string`
- `homepageIntro: string`
- `footerText: string`
- `routePath: string`
- `routeParams: Record<string, string>`
- `pages: ThemeEntry[]`
- `posts: ThemeEntry[]`
- `page?: ThemeEntry`
- `post?: ThemeEntry`

`ThemeEntry` shape:

- `title: string`
- `slug: string`
- `content: string`
- `updatedAt: string`
- `excerpt?: string`

## What core vs theme vs plugin should do

### Core responsibilities

- HTTP routing and URL matching (`core/http/public-router.ts`)
- Querying and filtering published content
- Constructing render context (site settings + route metadata + page/post data)
- Alias mapping and fallback template resolution
- Active theme resolution from canonical settings (`settings.theme`) against registered themes
- Consuming the theme registry boundary, not ad hoc built-in theme maps

### Theme responsibilities

- Layout, HTML structure, CSS styling
- Template-level rendering for canonical template names
- Visual hierarchy and presentation details

### Plugin responsibilities

- Optional capabilities and new feature surfaces
- Additional routes/content types/integrations
- Extending CMS capability without replacing core route/query responsibilities

Themes should not own business rules like publish/draft filtering or core content querying logic.

## Built-in theme examples

- `themes/default/index.ts` remains the canonical reference implementation.
- `themes/sunrise/index.ts` is a minimal second built-in theme proving active-theme switching on the canonical renderer path.

## Current limitations (honest status)

- Theme registration is still code-level (built-in definitions in `core/theme/theme-registry.ts`), not yet a disk-scanning marketplace/installer flow.
- No dedicated non-technical admin theme switcher UI exists yet; active theme currently follows canonical settings value (`theme`).
- Contract is stabilized for current public routes (`/`, `/blog`, `/blog/:slug`, `/:pageSlug`) and not yet expanded for additional content surfaces.
- Keep compatibility aliases only as migration support; do not introduce new aliases.

## Read-only admin/API consumption path

A minimal read-only admin path is now available for future non-technical UX wiring:

- `GET /admin-api/system/themes`

Response shape is aligned with `runtime.themes.getStatus()` and includes:

- `configuredThemeId`
- `resolvedThemeId`
- `defaultThemeId`
- `fallbackApplied`
- `themes[]` (`id`, `title`, `source`, `isDefault`, `templates`)

This phase intentionally does not add theme-write flows (picker UI, install, marketplace, etc.).

## Theme discovery/listing readiness

Canonical theme discovery for runtime/admin read consumers now goes through `runtime.themes` (`core/theme/theme-service.ts`):

- `runtime.themes.list()` returns safe theme metadata (`id`, `title`, `source`, `isDefault`, `templates`) without exposing template functions.
- `runtime.themes.getConfiguredThemeId()` returns configured selector value from settings.
- `runtime.themes.getResolvedThemeId()` returns fallback-aware active id.
- `runtime.themes.getStatus()` returns one read payload containing configured/resolved/default ids, `fallbackApplied`, and the theme list.

For compatibility/unit-level checks, renderer/registry helpers still exist (`listRegisteredPublicThemes`, `listRegisteredPublicThemeDetails`), but new read consumers should prefer `runtime.themes` as the canonical runtime path.
