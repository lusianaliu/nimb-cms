# Phase 37 — Deterministic Admin Control API

Phase 37 introduces an authenticated admin mutation boundary for runtime control.

## Command architecture

- Admin endpoints are under `/api/admin/*`.
- Requests are converted into serializable commands with:
  - `action`
  - `requestId`
  - deterministic payload shape
- Commands are dispatched through `CommandDispatcher`.
- Dispatcher behavior:
  - deterministic fingerprinting (`action + requestId + payload`)
  - replay cache for idempotent same-command responses
  - lifecycle visibility (`accepted` / `completed` diagnostics)
  - bounded history retention

## Admin boundary

- All admin endpoints require auth middleware.
- No endpoint mutates runtime state directly.
- Endpoint handlers issue commands only; execution is delegated through runtime admin executor.

Endpoints:

- `POST /api/admin/runtime/restart`
- `POST /api/admin/runtime/persist`
- `POST /api/admin/goals/reconcile`
- `GET /api/admin/status`

## Deterministic mutation rules

1. Commands require a deterministic `requestId`.
2. Identical command payloads replay from cache with identical envelopes.
3. Runtime persistence action writes canonicalized deterministic JSON.
4. Inspector reflects mutation visibility via `runtime.getInspector().admin()`:
   - `lastCommands`
   - `commandHistory`
   - `adminHealth`
