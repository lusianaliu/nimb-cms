# Phase 36 — Deterministic Auth & Session Foundation

This phase introduces a minimal authentication layer for administrative dashboard readiness while keeping runtime behavior deterministic.

## Auth lifecycle

1. Bootstrap creates `SessionStore` + `AuthService` using the persistence storage adapter.
2. `AuthService.restore()` loads persisted identities/sessions.
3. In development mode, first-run bootstrap identity is inserted:
   - username: `admin`
   - password: `admin`
4. HTTP auth endpoints use token-based session flow:
   - `POST /api/auth/login`
   - `POST /api/auth/logout`
   - `GET /api/auth/session`
5. Runtime inspector exposes auth status via `runtime.getInspector().auth()`.

## Session persistence

- Sessions and users are persisted in `.nimb/auth.json`.
- Store writes are deterministic:
  - Canonical key ordering.
  - Stable user/session ordering.
  - No-op writes when serialized content is unchanged.
- Restart restore rehydrates users/sessions from persistence before serving auth API traffic.

## Determinism guarantees

- Token payload is deterministic JSON (`userId`, `issuedAt`, `expiresAt`) signed with HMAC-SHA256.
- Session snapshots are canonicalized and sorted prior to persistence.
- Bootstrap admin user uses fixed deterministic identity metadata for stable first-run snapshots.
- Inspector auth payload is stable and read-only:
  - `activeSessions`
  - `users`
  - `authHealth`
