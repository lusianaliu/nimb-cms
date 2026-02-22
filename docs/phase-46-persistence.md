# Phase 46 — Deterministic Persistent Storage

## Storage model

Nimb now persists content entries to a single deterministic filesystem file at:

- `process.cwd()/data/entries.json`

The `EntryRegistry` is now responsible for both in-memory indexing and durable entry persistence.

## File structure

`data/entries.json` always contains:

- `schemaVersion`: current snapshot version (`"v1"`)
- `entries`: full canonical entry list

Entry ordering in this file is deterministic and sorted by `id`.

## Guarantees

The persistence behavior guarantees:

- **single canonical storage file** for entries
- **automatic file creation** when the file is missing
- **atomic writes** using temp-file then rename
- **stable JSON formatting** with 2-space indentation and trailing newline
- **deterministic ordering** of entries by `id`
- **immediate persistence** after entry mutations (create, update, lifecycle transition, delete)

## Restart safety

On bootstrap, `EntryRegistry` loads `data/entries.json` and hydrates in-memory state.

If the file cannot be parsed or has an invalid shape, bootstrap fails with a startup error.
Nimb does **not** silently reset entry data when corruption is detected.
