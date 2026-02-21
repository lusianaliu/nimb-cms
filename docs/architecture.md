# Nimb CMS Architecture (Phase 0 Draft)
Nimb CMS is designed as a plugin-first CMS where capabilities grow by extension.
The core stays domain-agnostic so it can support many content models.
Themes handle presentation only and must not own business logic.
Blocks represent content only and remain portable across themes.
Configuration should be explicit, versionable, and environment-aware.
This phase defines identity boundaries only, not runtime features.
Future phases can add services without violating these principles.

## Phase 3 Intent: Authorization Scaffolding
Authorization is modelled as a standalone capability layer that is independent from authentication.
Roles map to permissions in services so plugin modules can register additional permissions later.
Controllers invoke middleware checks before hitting protected actions to keep access rules explicit.


## Phase 4 Intent: Content Engine
Content is represented as structured data entities with workflow state, metadata, and revision history.
Controllers orchestrate transport concerns, services encapsulate workflow rules, and models define data shape constraints.
The content engine remains domain-agnostic so plugins can extend capabilities without coupling to rendering.

## Phase 6 Intent: Block Editor Data Model
Content body is stored as structured JSON blocks and each block is validated against a registered schema.
The block registry is the source of truth for block contracts so plugins can register additional semantic blocks.
Renderer integration is abstracted behind a renderer interface to keep core content definitions independent of theme or UI concerns.

## Phase 7 Intent: Hook System and Plugin Engine
The extension runtime is built around contracts so plugins can extend capabilities without reaching into core internals.
Event dispatching supports asynchronous listeners with isolated failure handling so one plugin cannot crash the full pipeline.
Hooks expose before/after execution points and filter pipelines for value transformations without hard-coding extension logic.
Plugin lifecycle is split into register and boot stages so structural registration happens before runtime side effects.
