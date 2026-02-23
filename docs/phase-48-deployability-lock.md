# Phase 48 — Deployability Lock (Nimb v1.0)

Phase 48 locks deployment-facing runtime guarantees for Nimb v1.0.
No new product features are introduced in this phase.

## v1.0 guarantees

- Runtime contract at `/health` now includes stable version and mode metadata.
- Standalone boot validates deployment invariants and fails fast when invalid.
- Runtime config is frozen after bootstrap and mutation attempts throw.
- Startup logs are deterministic and emitted in fixed order.
- Built output (`.nimb-build`) is verified through restart persistence integration flow.

## Deployment steps

1. Initialize a project:
   - `npx nimb init site`
2. Build deployment artifact:
   - `cd site`
   - `npx nimb build`
3. Run built runtime:
   - `cd .nimb-build`
   - `node bin/nimb.js`

Expected startup log order:

1. `Nimb vX.X.X`
2. `Mode: production|development`
3. `Admin: enabled (<basePath>) | disabled`
4. `Storage: active`
5. `Port: XXXX`
6. `Ready.`

## Upgrade expectations

- v1.0 keeps runtime bootstrap behavior deterministic.
- Deployments should keep `nimb.config.json` valid and explicit.
- Invalid runtime mode, missing admin assets (when enabled), unavailable port,
  or invalid persistence files now produce deterministic startup errors.

## Stability contract

- Phase 48 introduces validation + guarantees only.
- API surface remains unchanged except additive metadata fields in `/health`.
- Deploying from `.nimb-build` is contract-tested for restart persistence.
