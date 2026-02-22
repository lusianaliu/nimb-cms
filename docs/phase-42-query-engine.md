# Phase 42 — Deterministic Query Engine

This phase introduces deterministic querying for content entries.

## Query options

`GET /api/entries/:type` now accepts:

- `state`
- `limit`
- `offset`
- `sort` (`createdAt` | `updatedAt` | `id`)
- `order` (`asc` | `desc`)

## Determinism rules

- Default ordering is `createdAt asc`.
- All sorting is deterministic with stable tie-breakers.
- The same dataset and query always returns the same ordered result.
- Replay after restart preserves identical query ordering.

## Registry API

`EntryRegistry` now supports:

- `query(type, options)` for filtered, sorted, and paginated results.

`list(type)` remains available and delegates to default query behavior.

## Inspector metadata

Inspector output now includes `entryQuery` metadata with:

- `totalQueries`
- `lastQuery`

This helps verify query usage and replay safety across runtime activity.
