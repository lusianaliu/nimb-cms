# Phase 43 — Admin Surface Decoupling

## Intent

This phase removes a hardcoded admin mount and turns the admin UI into a configuration-driven interface layer.
The goal is architectural: keep API behavior deterministic while allowing admin and public surfaces to be deployed independently.

## What changed

- A dedicated config loader now includes an `admin` section:
  - `enabled` (default `true`)
  - `basePath` (default `/admin`)
  - `staticDir` (default `./ui/admin`)
- HTTP admin static mounting now uses `config.admin.basePath`.
- Admin static serving supports SPA fallback (`index.html`) under the configured mount.
- Runtime receives immutable config during bootstrap and exposes it through `runtime.getConfig()`.

## Why this matters

- **Separation of surfaces**: admin interface and public/API surface are no longer coupled to a fixed path.
- **Deployment flexibility**: operators can move admin behind an alternate path without code changes.
- **Reverse proxy compatibility**: proxies can route admin traffic to a dedicated location while API routes remain stable.

## Deterministic routing priority

Request handling order is deterministic and unchanged in principle:

1. API routes (`/api/*`)
2. Admin mount (`config.admin.basePath` when enabled)
3. Remaining runtime/static/fallback behavior

This guarantees that admin SPA fallback does not swallow API routes.

## Example

```json
{
  "admin": {
    "basePath": "/dashboard"
  }
}
```

With this config, the admin UI is served from `/dashboard` and no longer from `/admin`.
