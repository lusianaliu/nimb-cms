# Theme Author Guide (Canonical Public Theme Path)

This guide describes the active Nimb CMS public theme contract used by the canonical runtime path.

## Active path (canonical)

- Entrypoint: `bin/nimb.js`
- Bootstrap wiring: `core/bootstrap/createBootstrap` via `core/bootstrap/bootstrap.ts`
- Public router owner: `core/http/public-router.ts`
- Active public renderer: `runtime.themeRenderer` from `core/theme/theme-renderer.ts`
- Default canonical templates: `themes/default/index.ts`

`core/theme/theme-manager.ts` and `core/render/public-renderer.ts` exist but are not the active public route rendering path for the current runtime.

## Theme location and selection

At this phase, the runtime renders through built-in default templates in:

- `themes/default/index.ts`

The renderer currently chooses from `defaultThemeTemplates` and resolves legacy names to canonical names.

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

## Required vs optional template behavior

Current default theme exports all canonical templates. Future themes should implement all canonical template names for predictable behavior.

Fallback behavior currently handled by core renderer:

- If a legacy alias is used, core maps it to canonical name.
- If an unknown template name is requested, core falls back to `page`.

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

### Theme responsibilities

- Layout, HTML structure, CSS styling
- Template-level rendering for canonical template names
- Visual hierarchy and presentation details

### Plugin responsibilities

- Optional capabilities and new feature surfaces
- Additional routes/content types/integrations
- Extending CMS capability without replacing core route/query responsibilities

Themes should not own business rules like publish/draft filtering or core content querying logic.

## Default theme as reference implementation

`themes/default/index.ts` is the canonical reference for:

- homepage rendering
- page rendering
- blog list rendering
- blog post rendering
- not-found rendering
- shared layout/navigation/footer behavior

When building a custom theme, mirror this template contract first, then iterate visual design.

## Current limitations (honest status)

- Active theme source is still the built-in default template registry, not yet a fully dynamic theme package loader.
- Contract is stabilized for current public routes (`/`, `/blog`, `/blog/:slug`, `/:pageSlug`) and not yet expanded for additional content surfaces.
- Keep compatibility aliases only as migration support; do not introduce new aliases.
