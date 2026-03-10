# Phase 144 — Architecture Lock-In

Phase 144 freezes the active CMS runtime path to reduce ambiguity identified in Phase 143.

## Canonical decisions

- Entrypoint: `bin/nimb.js`
- Bootstrap path: `core/bootstrap/createBootstrap`
- Runtime object: `PluginRuntime` via existing runtime factory path
- Active CMS plugin loader: `core/plugin/plugin-loader.ts`
- Install-state source of truth: `data/system/config.json` (`installed` flag)
- Public route owner: `core/http/public-router.ts` (used via `createSiteRouter` delegation)

## Compatibility notes

- `data/install.lock` remains a compatibility marker written during install, but it is no longer authoritative for active install checks.
- `data/system/install.json` legacy helpers are retained only as compatibility shims and now delegate to system config semantics.
- Alternate plugin loaders remain for legacy/internal use and are explicitly marked:
  - `core/plugins/plugin-loader.ts` (legacy)
  - `core/runtime/plugin-runtime/plugin-loader.ts` (internal plugin-runtime subsystem)

## Auth boundary (provisional)

Auth remains provisional dual-path in this phase:

- admin web: cookie session path
- API path: token auth path

No auth redesign is included in Phase 144.
