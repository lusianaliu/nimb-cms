# Phase 24 — Deterministic Capability Routing

Phase 24 introduces deterministic capability routing in the runtime.
The resolver now routes capability invocations through a dedicated router,
allowing multiple providers for one capability while preserving deterministic selection.

## What was added

- `core/runtime/routing/` module:
  - `route-policy.ts`
  - `route-selector.ts`
  - `capability-router.ts`
  - `routing-snapshot.ts`
  - `index.ts`
- Runtime integration in capability resolution path:
  - invocation -> router -> selected provider -> execution
- Inspector extension:
  - `runtime.getInspector().routing()`
- Diagnostic events:
  - `routing:selected`
  - `routing:fallback`
  - `routing:rejected`

## Supported routing policies

### 1) `single` (default)
Selects a single provider, using explicit `providerId` when configured,
otherwise stable lexical ordering.

### 2) `priority`
Selects provider from an ordered list (`order`), with deterministic lexical
fallback for unspecified providers.

### 3) `weighted`
Selects provider with deterministic hashing over:
- capability id
- consumer id
- invocation key
- topology key
- policy salt

No randomness is used. Same inputs always route to the same provider.

### 4) `fallback`
Selects using ordered `chain` and routes to the first active provider.
If the first preferred provider is unavailable, router emits `routing:fallback`.

## Deterministic guarantees

- Same route inputs resolve to the same provider.
- Routing includes topology signature (`nodes:edges`) for topology-aware behavior.
- Version-incompatible providers are excluded from routing candidates.

## Runtime usage

Routing policies can be provided at runtime construction:

```js
const runtime = new PluginRuntime({
  pluginsDirectory,
  contracts,
  routingPolicies: {
    content: {
      type: 'weighted',
      weights: { 'provider-a': 3, 'provider-b': 1 },
      salt: 'phase24'
    }
  }
});
```

Inspector access:

```js
const routing = runtime.getInspector().routing();
console.log(routing.decisions);
```
