# Theme Author Guide (Canonical Public Theme Path)

This guide describes the active Nimb CMS public theme contract used by the canonical runtime path.

## Active path (canonical)

- Entrypoint: `bin/nimb.js`
- Bootstrap wiring: `core/bootstrap/createBootstrap` via `core/bootstrap/bootstrap.ts`
- Public router owner: `core/http/public-router.ts`
- Active public renderer: `runtime.themeRenderer` from `core/theme/theme-renderer.ts`
- Built-in canonical themes: `themes/default/index.ts`, `themes/sunrise/index.ts`

`core/theme/theme-manager.ts` and `core/render/public-renderer.ts` exist but are not the active public route rendering path for the current runtime.

## Theme location and active-theme selection

At this phase, built-in public themes live under:

- `themes/<theme-id>/index.ts`

Active public theme source-of-truth is:

- `runtime.settings.getSettings().theme`
- backed by `core/system/settings.ts` (`theme` field in `SiteSettings`)
- default value: `default`

This means Nimb now dynamically selects the active theme from one canonical setting key (`theme`) on the active renderer path.

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

Core fallback behavior in `core/theme/theme-renderer.ts`:

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
- Active theme resolution from canonical settings (`settings.theme`)

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

- Theme registration is still code-level (built-in map in `core/theme/theme-renderer.ts`), not yet a disk-scanning marketplace/installer flow.
- No dedicated non-technical admin theme switcher UI exists yet; active theme currently follows canonical settings value (`theme`).
- Contract is stabilized for current public routes (`/`, `/blog`, `/blog/:slug`, `/:pageSlug`) and not yet expanded for additional content surfaces.
- Keep compatibility aliases only as migration support; do not introduce new aliases.
