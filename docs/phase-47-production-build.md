# Phase 47 — Production Build System

## Purpose

`nimb build` creates a deterministic deployable package in `.nimb-build/` so runtime startup does not depend on the original source tree layout.

The command only includes runtime-critical assets and excludes development-oriented repository files by using an explicit allowlist.

## Build Output Layout

Running `nimb build` from a project root creates:

```txt
.nimb-build/
  bin/
  core/
  ui/
  package.json
  nimb.config.json
  public/ (copied only when present in project root)
```

### Included Runtime Assets

- `bin/` from the installed Nimb runtime package.
- `core/` from the installed Nimb runtime package.
- `ui/` from the installed Nimb runtime package.
- `package.json` from the installed Nimb runtime package.
- `nimb.config.json` from the project root.
- `public/` from the project root when available.

### Excluded by Design

Because the command is allowlist-driven, it does not copy repository content such as:

- tests
- docs
- phase files
- development scripts

## Deployment Flow

From an initialized project:

```bash
npx nimb build
cd .nimb-build
node bin/nimb.js
```

The runtime should start in standalone mode and serve `/health` without referencing source paths outside `.nimb-build`.

## Local vs Production Execution

- **Local development**: run `npx nimb` from your project root for normal iteration.
- **Production packaging**: run `npx nimb build` and deploy `.nimb-build/` as the runtime artifact.

The generated package preserves deterministic path behavior by keeping relative runtime paths (`bin`, `core`, `ui`, and `nimb.config.json`) inside the build output.
