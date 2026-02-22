# Phase 41 — Deterministic Entry Lifecycle

Phase 41 introduces explicit lifecycle states to content entries while preserving deterministic persistence and replay behavior.

## Entry model update

Each entry snapshot now stores:

- `id`
- `type`
- `data`
- `state`
- `createdAt`
- `updatedAt`

Default state for new entries is `draft`.

## Lifecycle states

- `draft`
- `published`
- `archived`

## Allowed transitions

Only these transitions are valid:

- `draft -> published`
- `published -> archived`
- `archived -> draft`

Invalid transitions are rejected with an explicit error. No implicit state mutation is performed.

## Determinism guarantees

- State transitions are explicit command actions.
- Transition requests are replay-safe because entry identity remains deterministic.
- Lifecycle state is stored in persisted entry snapshots.
- Restores replay lifecycle state deterministically after entry reconstruction.

## API surface

Entry creation remains:

- `POST /api/admin/entries/:type`

Lifecycle transitions are added:

- `POST /api/admin/entries/:type/:id/publish`
- `POST /api/admin/entries/:type/:id/archive`
- `POST /api/admin/entries/:type/:id/draft`

## Inspector

`runtime.getInspector().entries()` and `/inspector` now report per-type totals plus per-state counts.
