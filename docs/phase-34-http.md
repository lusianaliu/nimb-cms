# Phase 34 — Deterministic HTTP Runtime Server

Phase 34 adds a small native-Node HTTP runtime surface with deterministic JSON contracts.

## Server lifecycle

- Bootstrap initializes runtime first.
- The CLI (`bin/nimb.js`) creates and starts the HTTP server once runtime startup completes.
- Default port is `3000`.
- Process shutdown (`SIGINT` / `SIGTERM`) closes the HTTP server before exit.

## Routing model

- Implemented with a fixed route table in `core/http/router.ts`.
- Deterministic dispatch uses exact `method + path` matching.
- No middleware stack and no dynamic path patterns in this phase.

## Endpoint contract

All endpoints are JSON-only.

- `GET /health`
  - Response: `{ "status": "ok" }`
- `GET /runtime`
  - Response fields:
    - `mode`: runtime mode from config.
    - `plugins`: loaded plugin ids.
    - `uptime`: milliseconds since startup timestamp.
- `GET /inspector`
  - Response fields:
    - `state`
    - `orchestrator`
    - `goals`
    - `persistence`

Inspector data always comes from `runtime.getInspector()`.

## Determinism guarantees

- Response serialization canonicalizes object keys before JSON output.
- Router behavior is deterministic because route resolution is pure table lookup.
- Error payloads use a stable shape (`error.code`, `error.message`, `timestamp`).
- Request context time is supplied through an injectable runtime clock.
