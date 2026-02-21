# @nimblabs/plugin-content-basic

## Architectural purpose

`@nimblabs/plugin-content-basic` is the first reference plugin used to validate Nimb's plugin-first model in practice.
It is intentionally non-product and non-UI.
The plugin proves that content semantics can be introduced through extension contracts rather than core coupling.

## Contracts exercised

The plugin consumes and requires these public contracts:

- `plugin.registerCapability`
- `plugin.unregisterCapability` (via returned disposer)
- `plugin.registerSchema`
- `plugin.unregisterSchema` (via returned disposer)
- `plugin.registerLifecycleHook`

These contracts are declared explicitly in the manifest to keep governance enforceable and version-aware.

## Boundaries respected

- **Core domain-agnosticism preserved**: no core code changes were required for plugin code paths.
- **No internal imports**: plugin modules import only local plugin files.
- **No presentation concerns**: plugin contains no theme, rendering, or UI logic.
- **Blocks remain content-only**: schema `body` is block-structured data, not rendered output.

## Assumptions validated

- Capabilities can be opaque labels owned by plugins.
- Schema registration can remain portable and plugin-scoped.
- Lifecycle behavior can be deterministic via explicit order metadata.
- Plugin load/unload can remain reversible by contract-level disposers.

## Important governance note

Current runtime contracts in this repository do not yet expose all required first-class capability/schema/lifecycle registration APIs.
That gap is captured in `docs/architecture-gaps.md` with a proposal, and no shortcut implementation was introduced.
