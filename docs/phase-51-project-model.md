# Phase 51 — Canonical Project Structure Contract

Phase 51 establishes an explicit project structure contract for project-root execution.

This phase is boundary-only:

- no runtime behavior refactor,
- no plugin runtime API changes,
- no persistence schema changes.

## Engine root vs project root

Nimb now treats two roots as distinct boundaries:

- **Engine root**: the installed runtime package root (`bin/`, `core/`, `ui/`) used to execute Nimb.
- **Project root**: the user site root where project-scoped config, content data, plugins, themes, and runtime persistence live.

CLI startup resolves a project root deterministically (cwd by default, `--project-root` when provided, and `nimb start <projectPath>` compatibility input) and uses that root for project-scoped wiring.

## Canonical project structure

The canonical project contract is:

- `config/`
- `data/`
- `plugins/`
- `themes/`
- `public/` (future web root)
- `.nimb/` (runtime persistence)
- `nimb.config.json` (optional)

`core/project/project-paths.ts` provides `createProjectPaths(projectRoot)` to produce immutable, normalized, absolute paths for boundary wiring.

## Startup invariants

Startup invariants now enforce deterministic directory assurance for:

- `data/`
- `.nimb/`

If these directories are missing, startup creates them and logs whether each directory was created or verified.

`plugins/` and `themes/` remain optional at startup in this phase.

## Standalone compatibility

Existing standalone and cwd-based execution remains valid:

- `nimb`
- `nimb start`
- `nimb start <projectPath>`

Legacy phase-45 project layouts continue to run unchanged.

## Future installer alignment (conceptual)

This contract defines the stable shape that future installers can target. Installer behavior itself is intentionally out of scope for phase 51.
