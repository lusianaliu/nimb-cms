# Phase 40 — Deterministic Content Entries

Phase 40 extends deterministic content types into deterministic content entries.

## Entry model

Each entry is normalized into:

- `id`: stable deterministic UUID derived from canonical `{ type, data }`
- `type`: registered content type name
- `data`: validated schema-bound fields
- `createdAt`: write timestamp
- `updatedAt`: last mutation timestamp

## Determinism guarantees

- Entry data is canonicalized by recursive key ordering before validation and ID generation.
- Entry IDs are replay-safe because they are generated from stable type + data payloads.
- Persistence snapshots are sorted by `(type, id)` and written through deterministic storage serialization.
- Writes are idempotent for identical payloads: identical entry IDs are updated in place instead of duplicated.

## API surface

- Admin write:
  - `POST /api/admin/entries/:type`
- Public reads:
  - `GET /api/entries/:type`
  - `GET /api/entries/:type/:id`

## Runtime inspector

Runtime inspector now includes:

- `runtime.getInspector().entries()`
- `/inspector` response `entries` section with per-type entry counts

## Validation behavior

- Entry creation requires the target content type to exist.
- Required fields must be present.
- Field values must match primitive schema types.
- Unknown fields are rejected to preserve schema boundaries.
