# Plugin Author SDK (`definePlugin`)

## Purpose

`packages/plugin-sdk` provides a thin authoring facade for plugin authors. It offers a declarative `definePlugin()` API while compiling author input into the **existing runtime contracts** and manifest shape consumed by `core/runtime/plugin-runtime`.

## Architectural boundaries

The SDK is intentionally constrained:

- It does **not** modify the runtime.
- It does **not** access the runtime registry.
- It does **not** introduce plugin-specific behavior.
- It does **not** bypass platform contracts.

Plugin authors only describe intent (`capabilities`, `exportedCapabilities`, `schemas`, `lifecycle`) and the SDK adapter maps that intent to contract calls like `registerCapability`, `registerSchema`, `registerLifecycleHook`, and `useCapability`.

## Why wrap contracts instead of replacing them

Nimb's runtime contracts remain the source of truth. The SDK exists for ergonomics, not for altering architecture.

- Runtime validators still enforce manifest correctness.
- Runtime loader still resolves `manifest.ts` + `register.ts`.
- Runtime activation/unload semantics remain deterministic.
- Existing non-SDK plugins continue to function unchanged.

## Guarantees preserved

Using `definePlugin()` preserves:

1. **Contract-first integration** — registration flows through runtime contracts only.
2. **Deterministic activation/unload** — SDK returns the same register/disposer shape.
3. **Runtime isolation** — no coupling to runtime internals from plugin author code.
4. **Early failure on invalid definitions** — lightweight SDK-side validation catches malformed plugins before runtime activation.

## Author usage

```ts
import { definePlugin } from '../../packages/plugin-sdk/index.ts';

export default definePlugin({
  name: 'example-plugin',
  version: '1.0.0',
  capabilities: [
    { key: 'example:read', version: '1.0.0', description: 'Example capability' }
  ],
  schemas: [],
  lifecycle: {
    onStart: async (ctx) => ctx.logger.info('started', { plugin: ctx.pluginId }),
    onStop: async (ctx) => ctx.logger.info('stopped', { plugin: ctx.pluginId })
  }
});
```

A runnable reference exists at `examples/sdk-example-plugin/` and is bridged into runtime discovery via `plugins/sdk-example-plugin/`.
