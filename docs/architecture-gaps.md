# Architecture Gaps

## Current milestone-driven gap priorities (post-Phase 197)

### Priority 1 — Installability and deployment clarity

- Missing guided installer journey that non-technical users can complete with confidence.
- Missing explicit deployment packaging/runtime matrix for common operator environments.
- Missing install-to-running validation checkpoints that clearly explain what to fix next.

### Priority 2 — Editor and publishing usability

- Missing comfortable end-to-end authoring flow for pages/posts in admin.
- Missing scheduled publishing capability in the publishing workflow.
- Missing minimum blog authoring flow quality bar that feels practical for small teams.

### Priority 3 — Operational confidence

- Missing operator-focused diagnostics that connect symptoms to concrete remediation.
- Missing install/start/use/publish “confidence path” validation across realistic scenarios.

These priorities should outrank wording-only hardening or micro-refactors unless a real defect blocks milestone delivery.

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
