# Phase 38 — Deterministic Admin Dashboard (Static UI)

Phase 38 introduces the first runtime-served admin interface at `/admin`.

## UI philosophy

- The admin UI is plain static assets served by the runtime.
- No framework hydration, build-step client runtime, or SPA router behavior.
- The server remains the source of truth for system and admin state.

## Deterministic frontend rules

- No random values are generated client-side.
- No client-side timestamps are generated.
- UI panels render canonical server payloads directly.
- Authentication token is memory-only and cleared on login failure.

## Admin interaction model

1. User logs in with `/api/auth/login`.
2. Token is attached to authenticated API calls through `Authorization: Bearer ...`.
3. Dashboard reads:
   - `GET /api/system`
   - `GET /api/runtime`
   - `GET /api/admin/status`
4. Control actions dispatch authenticated commands:
   - `POST /api/admin/runtime/restart`
   - `POST /api/admin/runtime/persist`
   - `POST /api/admin/goals/reconcile`
5. After each command, dashboard refreshes runtime and admin snapshots.

This phase keeps the UI boundary explicitly deterministic and runtime-owned.
