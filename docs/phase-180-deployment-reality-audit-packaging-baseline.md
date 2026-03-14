# Phase 180 — Deployment Reality Audit & Packaging Baseline

## Scope audited

The Phase 180 audit focused on the active canonical startup/runtime path:

- CLI entrypoint and project-root resolution (`bin/nimb.js`)
- bootstrap + startup invariants (`core/bootstrap/bootstrap.ts`, `core/bootstrap/startup-invariants.ts`)
- active plugin loader path (`core/plugin/plugin-loader.ts`)
- admin static and fallback asset resolution in active HTTP routing (`core/http/admin-router.ts`)
- packaged build/release startup assumptions (`core/cli/build.ts`, `core/cli/release.ts`)

Legacy/non-canonical paths were not treated as deployment truth unless they still influence startup/runtime behavior.

## Environment-sensitive assumptions found

1. **Project root resolution in CLI start path was brittle**
   - `--project-root` and `NIMB_ROOT`/`NIMB_PROJECT_ROOT` were parsed, but the previous fallback order effectively always preferred invocation cwd before env root.
   - This reduced reliability for deployments that launch from a process cwd that is not the intended project root.

2. **Admin fallback asset resolution had cwd coupling**
   - `/admin/app.js` fallback logic used `process.cwd()` for bundled runtime admin script lookup.
   - In deployment scenarios with a non-project/non-runtime working directory, this can miss valid bundled assets even when `rootDirectory` is known.

3. **Writable filesystem expectations are strict and immediate**
   - Startup invariants create/write-check these directories:
     - `data/`
     - `data/system/`
     - `data/content/`
     - `data/uploads/`
     - persistence dir (`data/system/`)
     - `logs/`
   - Current runtime assumes writable filesystem access at startup.

4. **Packaging baseline expects rooted layout consistency**
   - Build output and runtime entrypoints expect a stable layout where core runtime code, admin assets, and project config/data directories are in expected relative locations.

## Low-risk hardening changes applied

1. **Project-root resolver extracted and hardened**
   - Added `core/cli/project-root-resolver.ts` and moved CLI parsing there.
   - Fallback precedence is now explicit and deployment-friendly:
     1. `--project-root`
     2. `NIMB_ROOT` or `NIMB_PROJECT_ROOT`
     3. invocation cwd
   - Blank root values are normalized and ignored.

2. **Admin fallback asset lookup hardened to prefer runtime root context**
   - Updated admin fallback handling so `/admin/app.js` checks:
     1. `<rootDirectory>/admin/app.js`
     2. `<process.cwd()>/admin/app.js`
   - This reduces accidental dependence on process cwd while preserving compatibility fallback behavior.

3. **Targeted regression coverage added for project-root behavior**
   - Added Phase 180 tests validating argument/env/cwd resolution behavior.

## Current packaging baseline (post-Phase 180)

Nimb currently requires the following minimum deployment baseline on the canonical path:

1. **Node runtime + persistent process model**
   - Nimb runs as a long-lived Node process serving HTTP.

2. **Resolvable project root**
   - Project root must be resolvable via `--project-root`, `NIMB_ROOT`/`NIMB_PROJECT_ROOT`, or process cwd.

3. **Writable storage locations at startup**
   - `data/system`, `data/content`, `data/uploads`, and `logs` must be writable by the process user.

4. **Canonical install-state source present or creatable**
   - Install-state source remains `data/system/config.json`.
   - Runtime can initialize with default install-state when missing, but parent path must be writable.

5. **Static/admin asset layout expectations**
   - Admin assets are served from project `admin/` or `public/admin/` when present.
   - When absent, runtime fallback can still serve built-in admin shell/script.
   - Packaged mode expects `dist/public/admin` style availability per existing build/release flow.

## Remaining blockers and unresolved risks

1. **No full shared-hosting compatibility claim yet (hard blocker for such claims)**
   - Runtime model assumes direct Node HTTP process control and startup invariant checks.
   - This is incompatible with many shared-hosting models that do not permit persistent Node services or writable runtime paths in expected locations.

2. **Strict writable-directory requirements remain (hard blocker in read-only/containerized targets)**
   - Startup fails if required directories are not writable.
   - No alternate storage provider/fallback mode exists in canonical path for read-only roots.

3. **Packaging/deployment ergonomics remain manual (confidence gap)**
   - Build/release output exists, but there is no guided install/deploy handshake validating host constraints before first boot.

4. **Operational preflight diagnostics are limited (confidence gap)**
   - Invariants fail clearly, but there is no dedicated deployment preflight command/report for non-technical operators.

## Validation run in this phase

- `node --test test/phase180-project-root-resolution.integration.test.ts`
- `node --test test/phase147-admin-route-reliability.integration.test.ts`

Both passed in the current environment.

## Phase 181 recommendation

Focus Phase 181 on a **deployment preflight command + diagnostics baseline** for canonical runtime (non-installer), including explicit host capability checks and actionable remediation output without changing architecture.
