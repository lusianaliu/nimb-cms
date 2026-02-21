# Architecture Gaps

## Gap: Missing first-class plugin contracts for capabilities, schemas, and lifecycle hooks

### Observed state
Current public plugin runtime context exposes contracts for permissions, blocks, routes, events, and generic hooks, but does not expose explicit contracts for:
- capability registration/unregistration
- portable schema registration/unregistration
- named lifecycle hook registration with deterministic order metadata

### Why this matters
The `@nimblabs/plugin-content-basic` reference plugin is designed to prove architecture, not implement feature shortcuts. Without explicit contracts, plugin authors would need to overload unrelated contracts (for example, mapping capabilities to permissions), which weakens governance and contract clarity.

### Proposed contract extension (not implemented in core here)
Introduce the following platform extension contracts:
- `plugin.registerCapability(definition) -> dispose`
- `plugin.registerSchema(definition) -> dispose`
- `plugin.registerLifecycleHook(definition) -> dispose`

Each contract should:
- be versioned
- return a disposer for reversible unload
- guarantee isolation (plugin errors do not crash the platform)
- guarantee deterministic ordering for lifecycle hooks

### Status
Documented as a governance-aligned extension proposal only.
No core shortcuts were implemented.
