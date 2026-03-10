# Phase 143 — Nimb CMS Repository Reconciliation Report

## 1. Executive reality summary

Nimb currently runs through a TypeScript-centric `core/` runtime started by the CLI (`bin/nimb.js`), not through `src/index.js`.

The active system is a hybrid:
- a large plugin-runtime object (`PluginRuntime`) used as the global runtime container,
- an HTTP server/request handler that wires installer, admin, API, plugin routes, and public routes,
- file-based persistence spread across multiple mechanisms.

Core website behavior (installer, admin login, content CRUD, default theme routes) exists and is functional enough to boot and serve a basic site, but architecture is not fully reconciled:
- there are duplicate plugin loaders,
- duplicate install-state mechanisms,
- overlapping public route definitions,
- overlapping auth/session implementations,
- docs that describe systems that are not the currently wired path.

So the codebase is **functional but architecturally ambiguous** in several critical boundaries.

## 2. Canonical active path

### Canonical entrypoint
- **Active path appears to be** `bin/nimb.js` (used by `npm start` and package bin mapping).
- Evidence: `package.json` scripts/bin map to `bin/nimb.js`; CLI branches call startup/build/release flow.

### Canonical bootstrap path
- **Active path appears to be** `createBootstrap()` from `core/bootstrap/bootstrap.ts` called by `bin/nimb.js` (`startServer`/`startBridge`).
- Bootstrap wires runtime, auth, content, plugin loader, admin, theme, persistence.

### Canonical runtime path
- **Active path appears to be** `createRuntime()` -> `PluginRuntime` (`core/runtime/plugin-runtime/lifecycle-runner.ts`) via `core/bootstrap/runtime-factory.ts`.
- Runtime is then extended with CMS concerns in bootstrap (content registries, db proxy, admin registries, theme manager/renderer, hooks, event bus).

### Canonical plugin path
- **Active path appears to be** `core/plugin/plugin-loader.ts` (singular `plugin`) invoked from bootstrap.
- Supported manifests in this path: `manifest.json` first, fallback `plugin.json`.
- Lifecycle support in this path: default object `{ setup(runtime) }`, named `activate(runtime)`, or default registration function with API envelope.

### Canonical auth path
- **Active admin auth path appears to be** cookie session auth through:
  - `/admin/login` + `/admin/logout` in `core/http/admin-auth-router.ts`,
  - session validation middleware in `core/auth/admin-auth-middleware.ts`.
- **Also present**: token auth in `core/auth/auth-middleware.ts` used in `/api/auth/login` style routes in `core/api/api-router.ts`.
- Result: canonical auth is **not fully single-path yet** (cookie path for admin, token path for API).

### Canonical install-state path
- **No single canonical source is fully enforced.**
- Active logic currently checks multiple files:
  - bootstrap mode calculation uses `data/system/config.json` + `data/install.lock` + `installed===true` from config,
  - install guard checks only `data/install.lock`,
  - runtime mode resolver uses `data/system/install.json` via project install-state helper.
- This is a confirmed conflict.

### Canonical theme/render path
- **Active path appears to be** `runtime.themeRenderer` (`core/theme/theme-renderer.ts`) used by `core/http/public-router.ts` through `createSiteRouter()`.
- `theme-manager` exists but is not the primary call site for public route rendering.

## 3. Duplicate / conflicting systems

### 3.1 Entrypoint + app bootstrap duplication
- Subsystem: Entrypoint/runtime boot
- Competing paths:
  - `bin/nimb.js` + `core/bootstrap/*` + `core/runtime/*` (active)
  - `src/index.js` + `src/core/system/application.js` (alternate)
- What each does:
  - `bin/nimb.js` starts HTTP/bridge modes and full core runtime.
  - `src/index.js` boots legacy `Application` with different services and imports a runtime class directly.
- Active: `bin/nimb.js`.
- Risk: **High** (confusion for future contributors; accidental divergence).

### 3.2 Plugin loader triplication
- Subsystem: Plugin loading/contracts
- Competing paths:
  - `core/plugin/plugin-loader.ts` (active in bootstrap)
  - `core/plugins/plugin-loader.ts` (legacy loader expecting `index.ts` + optional `config.json`)
  - `core/runtime/plugin-runtime/plugin-loader.ts` (manifest.ts register entrypoint loader used by runtime internals/docs assumptions)
- Active: `core/plugin/plugin-loader.ts` from bootstrap.
- Risk: **High** (different manifest formats and lifecycle contracts).

### 3.3 Install state duplication
- Subsystem: Install-state source-of-truth
- Competing paths/files:
  - `data/system/config.json` via `core/system/system-config.ts`
  - `data/install.lock` via `core/installer/install-lock.ts`
  - `data/system/install.json` via `core/project/install-state.ts` and `core/setup/setup-state.ts`
- Active:
  - installer writes config + lock,
  - guard checks lock,
  - runtime mode resolver checks install.json.
- Risk: **High** (mode/guard drift and inconsistent “installed” behavior).

### 3.4 Public route duplication/override
- Subsystem: Public website routes
- Competing definitions:
  - `core/http/public-router.ts` defines `/`, `/blog`, `/blog/:slug`, `/:pageSlug` (theme-renderer + db query)
  - `core/http/site-router.ts` creates public router then registers `/` and `/:slug` again (uses runtime.content path)
- Active: both registered; later registrations overwrite exact route handlers.
- Risk: **Medium-High** (behavior depends on registration order and data source differences).

### 3.5 Auth model overlap
- Subsystem: Auth/session
- Competing models:
  - cookie session model for admin (`runtime.sessions` + admin cookie middleware/router)
  - bearer token model for API (`authMiddleware` in `core/api/api-router.ts`)
- Active: both active in different route families.
- Risk: **Medium** (can be valid long-term, but currently under-documented and inconsistent in protection boundaries).

### 3.6 Persistence overlap
- Subsystem: Persistence/data storage
- Coexisting mechanisms:
  - DB adapter (`core/db/file-adapter.ts`) writing entry files and indices in `data/content/<type>/...`
  - content snapshot (`core/storage/json-storage-adapter.ts`) writing `data/content.json`
  - persistence engine (`core/persistence/*`) writing runtime/goals/orchestrator into `data/system/*.json`
  - entry registry disk persistence (`core/content/entry-registry.ts`, invoked from bootstrap)
- Active: all are touched from bootstrap/runtime flows.
- Risk: **High** (multiple persistence planes for related data).

## 4. Phase 135–142 reconciliation

### bootstrap architecture — **KEEP (with REVISE notes)**
- Why: `createBootstrap` is real, active, and central.
- Revise: normalize install-state decision logic and simplify subsystem wiring order.

### runtime API — **KEEP**
- Why: `PluginRuntime` is active runtime object in bootstrap and request pipeline.
- Caveat: runtime carries both platform/runtime concerns and CMS concerns; boundaries are broad.

### plugin system — **REVISE**
- Why: active loader exists and works, but competing loaders/contracts/manifests are present.
- Action: freeze on one loader contract and deprecate others explicitly.

### auth/session — **REVISE**
- Why: admin cookie flow works, token flow exists, and route protection is uneven.
- Action: document dual model or consolidate policy and guard coverage.

### installer — **REVISE**
- Why: installer flow works (`/install`, writes config/lock/admin state), but install truth is split across 3 mechanisms.

### admin panel — **PARTIAL / REVISE**
- Why: there is a real route tree with pages/forms/controllers, but still mixed between shell rendering, inline HTML responses, and placeholder page registry.

### theme system — **KEEP (provisional)**
- Why: default theme rendering path is active for homepage/blog/page routes.
- Revise: reconcile theme-renderer vs theme-manager as single public rendering abstraction.

### public routing — **REVISE**
- Why: duplicate definitions in site/public router with mixed query sources.

### content model — **KEEP**
- Why: built-in types (`page`, `post`, `media`) + field type registry + command/query services are active.
- Revise: ensure all admin/public flows consistently use same storage/query path.

### database/storage — **REVISE**
- Why: functional file adapter exists, but persistence layering is fragmented.

### plugin SDK — **NOT VERIFIED**
- Why: docs reference SDK package/runtime shape that is not clearly the bootstrap-wired plugin path in this repo tree.

### docs assumptions — **REVISE / DEPRECATE partial docs**
- Why: several docs describe runtime/plugin manifest contracts that differ from active bootstrap loader behavior.

## 5. Current maturity assessment

- Install readiness: **functional but rough**
  - install page + POST handler + lock/config writing works, but install-state authority is inconsistent.
- Admin readiness: **partially usable**
  - login/session and content/admin pages exist; UI consistency and protection boundaries need hardening.
- Public-site readiness: **usable** for a simple site/blog baseline
  - homepage/blog/post/page routes and default rendering exist.
- Plugin-platform readiness: **incomplete**
  - plugin loading works, but architecture conflict between loader families/contracts is unresolved.
- Developer readiness: **functional but rough**
  - many subsystems exist, but canonical path ambiguity increases change risk.
- End-user readiness: **partially usable**
  - basic install/admin/public workflow exists; polish and consistency still below “stable non-technical default”.

## 6. Architectural freeze recommendation

1. Use `bin/nimb.js` + `core/bootstrap/createBootstrap` as the only sanctioned runtime startup path.
2. Treat `src/index.js` + `src/core/system/application.js` path as legacy/scaffold; do not build new features there.
3. Freeze plugin loading on `core/plugin/plugin-loader.ts` (manifest.json/plugin.json contract) until a deliberate migration is approved.
4. Declare `data/system/config.json` (installed flag + metadata) as install-state source-of-truth; keep `install.lock` only as compatibility gate or remove after migration.
5. Update install guard and runtime mode resolver to use the same install-state source.
6. Freeze public routing to one router definition (prefer `core/http/public-router.ts`) and remove duplicate `/` and `/:slug` registration in `site-router`.
7. Freeze theme rendering through one abstraction (`themeRenderer` currently active), then decide whether `themeManager` remains public API or internal helper.
8. Keep dual auth models only if explicitly documented:
   - cookie sessions for admin web,
   - token auth for API.
   Otherwise unify.
9. Do not add feature work that depends on deprecated plugin/runtime loader variants.
10. Before Phase 144 features, publish a short architecture map in docs that reflects active code exactly.

## 7. Immediate cleanup tasks before new features

1. **Install-state unification:** make guard/bootstrap/runtime mode all read the same state source.
2. **Plugin loader consolidation:** keep one active loader and mark others deprecated (or remove).
3. **Public route deduplication:** remove overlapping route registration in `site-router`.
4. **Auth boundary audit:** ensure admin APIs requiring auth are actually protected consistently.
5. **Persistence map cleanup:** document and reduce overlapping content persistence layers.
6. **Legacy path quarantine:** clearly mark `src/` runtime path as legacy and exclude from active architecture docs.
7. **Docs reconciliation:** update architecture/plugin docs to current active path.

## 8. Open questions

1. Should `install.lock` continue to exist after install-state unification, or be transitional only?
2. Should `data/system/install.json` be migrated into system config, or kept for backward compatibility with migration tooling?
3. Is the intended long-term plugin contract the current `manifest.json/plugin.json` loader, or the `manifest.ts` register-entrypoint runtime loader?
4. Should admin API routes under `/admin-api/*` all require session auth middleware by default?
5. Which content read path is canonical for public rendering (`runtime.db.query` vs `runtime.content` abstractions)?
6. Which persistence artifact is canonical for content: per-entry files, entry registry files, or content snapshot JSON?

---

# Architecture Freeze Decisions for Future Phases

- Decision: Canonical entrypoint is `bin/nimb.js`.
- Status: CONFIRMED
- Evidence: package start/bin mapping and direct startup wiring to bootstrap.
- Action for future phases: do not introduce alternate startup entrypoints.

- Decision: Canonical bootstrap path is `core/bootstrap/createBootstrap`.
- Status: CONFIRMED
- Evidence: server and bridge startup both call `createBootstrap`.
- Action for future phases: wire new runtime subsystems only via bootstrap composition.

- Decision: Canonical runtime object is `PluginRuntime` from `core/runtime/plugin-runtime/lifecycle-runner.ts`.
- Status: CONFIRMED
- Evidence: runtime-factory constructs this object; bootstrap and request handler use it.
- Action for future phases: avoid parallel runtime classes for production path.

- Decision: Canonical plugin loader is currently `core/plugin/plugin-loader.ts`.
- Status: PROVISIONAL
- Evidence: bootstrap imports and executes this loader.
- Action for future phases: freeze on this loader until planned migration; deprecate alternatives.

- Decision: Auth/session model is dual-path (admin cookie sessions + API token auth).
- Status: PROVISIONAL
- Evidence: admin auth router/middleware and API router token middleware both exist.
- Action for future phases: formalize as intentional dual model or consolidate.

- Decision: Install-state source-of-truth is not yet singular.
- Status: PROVISIONAL
- Evidence: config.json, install.lock, and install.json are all used by different code paths.
- Action for future phases: unify to one source before feature expansion.

- Decision: Canonical admin route path is `/admin` served by admin router + admin auth router + admin content router.
- Status: CONFIRMED
- Evidence: request-handler dispatch order and route construction.
- Action for future phases: keep admin UX work on these routes; avoid legacy UI paths.

- Decision: Canonical theme/render path is `runtime.themeRenderer` through public/site router pipeline.
- Status: PROVISIONAL
- Evidence: public routes call `runtime.themeRenderer.renderTemplate/renderThemePage`.
- Action for future phases: resolve overlap with `themeManager` and document one public render abstraction.

- Decision: Canonical public route path is request-handler -> site router/public router.
- Status: PROVISIONAL
- Evidence: request-handler dispatches `siteRouter` for website routes; duplicate route definitions still exist.
- Action for future phases: deduplicate route ownership before adding new public features.

- Decision: Canonical DB/storage path is file adapter (`core/db/file-adapter.ts`) for content entry CRUD.
- Status: PROVISIONAL
- Evidence: bootstrap sets `runtime.db = createDatabase(runtime)` and public router queries `runtime.db`.
- Action for future phases: rationalize overlap with snapshot and entry-registry persistence.

---

# Ready for Phase 144?

Answer:
- NO

Reason:
Phase 144 feature work should wait until minimum reconciliation is complete in three blocking areas:
1. single install-state source-of-truth,
2. single plugin loader contract,
3. deduplicated public route ownership.

Safest next objective before feature expansion:
- “Phase 144: Architecture lock-in patch” that removes duplicate active paths (install-state, plugin loader selection, and public route duplication) without adding new user features.
