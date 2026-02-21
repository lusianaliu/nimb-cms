# Plugin Validation Report: @nimblabs/plugin-content-basic

## Contracts used

- Manifest-declared contract requirements for capability, schema, and lifecycle registration.
- Registration entrypoint with contract assertions.
- Reversible disposers for capability, schema, and lifecycle hook teardown.

## Invariants confirmed

- Core can remain domain-agnostic when content semantics live in plugins.
- Capabilities are plugin-defined and opaque to core business logic.
- `article` schema is portable and presentation-independent.
- Lifecycle hook behavior is isolated and deterministic by explicit ordering metadata.

## Boundary tension discovered

A contract surface gap exists: current runtime context does not yet provide first-class APIs for capability/schema/lifecycle registration with disposer-based unload semantics.

## Recommendations for future plugins

1. Treat manifest-declared contracts as mandatory runtime gates.
2. Require disposer-returning registration APIs for every plugin-owned extension point.
3. Keep schema definitions portable and block-oriented.
4. Use lifecycle hook order metadata to preserve deterministic execution.
5. Preserve strict no-internal-import boundaries for plugin packages.
