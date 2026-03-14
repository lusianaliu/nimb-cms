# Phase 181 — Deployment Preflight Diagnostics Command

## Canonical command

Phase 181 adds a canonical deployment preflight command on the existing CLI entrypoint:

```bash
node bin/nimb.js preflight
```

Project-root resolution follows the same canonical precedence introduced in Phase 180:

1. `--project-root`
2. `NIMB_ROOT` / `NIMB_PROJECT_ROOT`
3. invocation working directory

Example:

```bash
node bin/nimb.js preflight --project-root /srv/nimb-site
```

## What preflight checks

The command is grounded in the active canonical runtime assumptions and checks:

1. **Project root resolution and shape**
   - resolved project root exists and is a directory

2. **Config availability and validity**
   - `config/nimb.config.json` or legacy `nimb.config.json` is discoverable
   - config parses/validates against current startup rules

3. **Canonical install-state source**
   - `data/system/config.json` exists as a file and can be parsed as JSON

4. **Canonical layout directories**
   - expected directories (`plugins`, `themes`, `public`) exist as directories

5. **Required writable runtime directories**
   - `data`, `data/system`, `data/content`, `data/uploads`, `logs`
   - existing directories are checked with a temporary write probe
   - missing required directories are evaluated based on parent-path writability

6. **Admin static directory availability**
   - when admin is enabled, the resolved `admin.staticDir` path is checked
   - default static-dir absence is a warning because fallback admin assets can still serve
   - explicitly configured static-dir absence/non-directory is a startup-aligned failure

7. **Startup parity checks**
   - selected startup port validity/availability is checked using startup port precedence (`PORT` then `config.server.port` then `3000`)
   - optional `data/system/runtime.json` is validated as JSON when present

## PASS / WARN / FAIL meaning

- **PASS**: check is satisfied.
- **WARN**: startup may still work, but layout/config risk exists.
- **FAIL**: likely startup blocker on the canonical path.

The command exits with code:
- `0` when there are only PASS/WARN findings
- `1` when at least one FAIL finding exists

Phase 182 note: preflight now includes async checks (startup port probe) while preserving the same CLI output format and exit semantics.

## Safety and limits

Preflight is diagnostic-oriented and does not boot normal serving mode.

- It does **not** mutate install-state (`data/system/config.json`).
- It does **not** run installer/setup flows.
- It does **not** prove universal hosting compatibility.
- It does **not** guarantee runtime correctness beyond checked path/layout/writability assumptions.

A temporary write probe file is created and removed when checking writability on existing required directories.

## Fit with Phase 180 baseline

This phase builds directly on Phase 180 by adding a canonical operator-facing command that makes deployment blockers and risks visible before full startup, without changing the active `PluginRuntime` architecture.
