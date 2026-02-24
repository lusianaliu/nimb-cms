# Phase 49 — Canonical Project Model Boundary

Phase 49 introduces a canonical project boundary model to prepare Nimb for user-installable multi-site operation.

This phase is boundary-only:

- no runtime internals refactor,
- no plugin API changes,
- no persistence format changes,
- standalone compatibility remains intact.

## Project boundary model

`core/project/project-model.ts` defines deterministic, root-scoped project paths:

- `nimb.config.json`
- `content/`
- `data/`
- `plugins/`
- `themes/`
- `public/`
- `.nimb/` (persistence)
- `.nimb-build/` (build output)

## Boundary integration points

- CLI boot/build/init now resolve and use the project model for root-scoped operations.
- Bootstrap receives the resolved project model and uses it for persistence, entries, and plugin loading boundaries.
- Startup invariant checks validate writability using project-model paths.

## Initialization structure

`nimb init` now scaffolds `themes/` in addition to existing project directories to reserve a presentation-only boundary for future installer flows.
