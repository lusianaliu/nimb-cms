# Phase 39 — Deterministic Content Model System

Phase 39 introduces deterministic content type schemas as a stable foundation for the CMS data layer.

## Schema philosophy

- Content types are explicit contracts: `{ name, fields[] }`.
- Field definitions remain content-only and implementation-agnostic.
- Supported primitive field types are fixed in this phase:
  - `string`
  - `text`
  - `number`
  - `boolean`
  - `datetime`
- No dynamic execution paths are allowed in schema definition or validation.

## Determinism guarantees

- Fields are normalized into canonical ordering before hash or persistence.
- Schema hashes are computed from normalized payloads only.
- Mutations are restricted to authenticated admin commands (`POST /api/admin/content-types`).
- Schema persistence uses snapshot-safe write semantics through the shared storage adapter.
- Rehydration restores identical schema state and inspector metadata across restarts.

## Runtime and API surface

- Admin mutation endpoint:
  - `POST /api/admin/content-types`
- Read endpoints:
  - `GET /api/content-types`
  - `GET /api/content-types/:name`
- Runtime inspector now exposes `runtime.getInspector().content()` with:
  - registered content type names
  - schema hashes
  - validation state

## CMS evolution path

This phase intentionally stops at deterministic type contracts and registry behavior.
Future phases can add:

1. content entry persistence bound to schema hashes,
2. migration planning between schema versions,
3. plugin-provided schema extensions with policy controls,
4. deterministic rendering contracts for theme consumption.
