# Plugin Reference: `@nimblabs/plugin-comment-basic`

## Intent

`@nimblabs/plugin-comment-basic` is a second reference plugin used to validate Nimb CMS architectural extensibility across independent domains. Instead of content management semantics, it introduces **comment system semantics** using only platform-level contracts.

This plugin is intentionally lightweight: it proves contract sufficiency, not product completeness.

## Architectural Independence

The plugin is isolated from core internals and runtime implementation details:

- Uses only runtime contract surface methods provided at registration time.
- Declares plugin-owned capabilities (`comment:*`) as opaque labels.
- Contributes a portable schema (`comment-basic.comment`) without UI, theme, or transport assumptions.
- Registers deterministic lifecycle hooks that log behavior and contain their own failures.

No imports are taken from `core/` or `src/core/` internals from the plugin implementation.

## Contracts Used

The plugin requires and consumes these contract families:

- `plugin.registerCapability`
- `plugin.unregisterCapability`
- `plugin.registerSchema`
- `plugin.unregisterSchema`
- `plugin.registerLifecycleHook`
- `logger` (runtime-provided)

These are declared in `manifest.ts` and asserted in `register.ts` before plugin activation work begins.

## Why Core Modification Was Not Required

The plugin validates the platform contract model by proving a second domain can be added through:

1. Capability registration
2. Schema registration
3. Lifecycle hook registration
4. Disposer-based teardown

All four are already available in the runtime contract surface. No additional core services, runtime hooks, or internal APIs were required.

## Comparison with `content-basic`

Similarities:

- Same governance-oriented manifest shape.
- Same contract-only registration model.
- Same deterministic lifecycle ordering with failure-safe logging.
- Same disposer teardown strategy.

Differences:

- Domain semantics are independent (`comment:*` vs `content:*`).
- Schema structure is comment-centric (`id`, `content`, `author`, `createdAt`, `status`).
- Hook names are comment workflow-specific (`onCommentCreate`, `beforeCommentSave`, `afterCommentPublish`).

This comparison supports the claim that Nimb plugins can define domain semantics without requiring core awareness.
