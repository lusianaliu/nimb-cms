# Phase 33 — Deterministic Persistence Layer

Phase 33 introduces a filesystem persistence subsystem for deterministic runtime save/restore behavior.

## Persistence model

Persistence stores runtime state as versioned JSON in `.nimb/`:

- `.nimb/runtime.json`
- `.nimb/goals.json`
- `.nimb/orchestrator.json`

All payloads are canonicalized (sorted keys), serialized with stable formatting, and frozen when restored.

## Adapter design

`core/persistence/storage-adapter.ts` defines the async storage contract:

- `read(key)`
- `write(key, data)`
- `delete(key)`
- `list(prefix)`

`core/persistence/fs-adapter.ts` provides the first backend using local files and atomic write via temporary file + rename.

## Restore lifecycle

Bootstrap startup sequence is now:

1. Load config.
2. Create persistence engine.
3. Restore snapshot from `.nimb/`.
4. Seed runtime with restored state.
5. Start runtime lifecycle.
6. Persist post-start snapshot.

This ensures persisted state exists before lifecycle activation and is available via inspector diagnostics.

## Determinism guarantees

Determinism is preserved through:

- canonical object key ordering before serialization
- stable JSON output (`2`-space indentation + trailing newline)
- normalized runtime volatile fields (`createdAt`, `timestamp`, `snapshotId`) before disk writes
- immutable persisted snapshot structures after restore
- stable storage key ordering during write/list operations

## Inspector extension

`runtime.getInspector().persistence()` now returns:

- `lastSaveTime`
- `storedKeys`
- `storageHealth`
