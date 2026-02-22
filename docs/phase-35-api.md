# Phase 35 — Deterministic REST API Layer

## API architecture

Phase 35 introduces a dedicated API namespace mounted under `/api/*`.
The HTTP runtime keeps system/public routes (`/health`, `/runtime`, `/inspector`) separate from deterministic API routes.

API route dispatch now flows through `core/api/api-router.ts`, which is mounted in the HTTP server before public route dispatch.
This keeps API behavior isolated while reusing the existing base HTTP router.

## Controller model

API routes follow a deterministic controller contract:

- controller signature: `(context, runtime) => ApiResponse`
- pure inspector reads only
- no direct filesystem access

Each route composes a controller with `createApiController(...)`.
Controller execution failures are normalized into a stable API error payload.

## Response contract

All successful responses are shaped as:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

All error responses are shaped as:

```json
{
  "success": false,
  "error": {
    "code": "...",
    "message": "..."
  }
}
```

The HTTP JSON writer canonicalizes key order recursively, so payload serialization remains stable for repeated equivalent calls.

## Determinism guarantees

Determinism in this phase is provided by:

1. inspector-only read model for API data
2. canonical JSON key ordering during response serialization
3. repeat-call assertions in integration coverage

The phase 35 integration test validates:

- endpoints exist at `/api/system`, `/api/runtime`, `/api/goals`, `/api/persistence`
- success schema consistency
- stable payload equality across repeated calls
- deterministic API 404 error contract
