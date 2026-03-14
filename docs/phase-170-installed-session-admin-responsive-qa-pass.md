# Phase 170 — Installed-Session Admin Responsive QA Pass

## Scope

Phase 170 extends Phase 169 by validating responsive behavior in a real installed/admin-authenticated session with seeded content.
This phase keeps existing routes, flows, and runtime architecture intact and applies only low-risk responsive polish.

## Deterministic installed-session QA setup

1. Start an installed runtime-backed test server from repository root:

   ```bash
   node --input-type=module -e "import { createInstalledServer } from './test/helpers/create-installed-server.ts'; const started = await createInstalledServer({ cwd: process.cwd() }); console.log('QA_SERVER_PORT=' + started.port); setInterval(()=>{},1<<30);"
   ```

2. Sign in using bootstrap credentials:
   - Email: `admin@nimb.local`
   - Password: `admin`

3. Seed realistic deterministic list data (if currently empty) through canonical admin APIs:
   - Pages seeded: 4
   - Posts seeded: 3
   - Data includes medium/long titles, long slugs, and mixed draft/published statuses.

4. Validate canonical admin routes at multiple widths:
   - Mobile portrait: `390x900`
   - Tablet-ish: `768x900`
   - Desktop: `1280x900`

   Surfaces checked:
   - `/admin`
   - `/admin/pages`
   - `/admin/posts`
   - `/admin/pages/new`
   - `/admin/posts/new`
   - `/admin/settings`

## Installed-session findings

- Dashboard, forms, and settings remained readable at tested widths with no major overflow regressions.
- Pages/posts list views used intended horizontal table containment (`.table-wrap`) on narrow viewports.
- A small mobile overflow issue was observed in installed list views: the main admin column could exceed viewport width due to mobile padding sizing behavior.

## Responsive fixes applied

- Reduced table minimum width to keep realistic list content less cramped on mobile while preserving horizontal scroll fallback:
  - base table `min-width`: `640px` → `520px`
  - medium breakpoint table `min-width`: `560px` → `480px`
- Added explicit mobile-width guardrail for the main column at <=900px:
  - `.admin-main { width: 100%; ... }`

These changes are scoped, CSS-only, and preserve all existing admin route and behavior semantics.

## Validation notes and remaining approximation

- Installed/authenticated QA and seeded-data route checks were performed with Playwright (Firefox) across target widths.
- A screenshot artifact was captured for the mobile pages list to preserve evidence of the logged-in responsive state.
- Environment nuance: Chromium in this environment crashed during launch; Firefox automation was used for this phase validation.

