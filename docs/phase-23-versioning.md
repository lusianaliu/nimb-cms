# Phase 23 — Capability Versioning & Compatibility

Phase 23 introduces runtime-owned capability version negotiation with deterministic provider resolution.

## Manifest Contract Extensions

Plugins declare capability versions and consumption ranges without direct plugin references:

```ts
providedCapabilities: {
  content: { version: '1.0.0' }
},
consumedCapabilities: {
  content: { range: '^1.0.0' }
}
```

Legacy `consumedCapabilities: string[]` is still accepted and normalized to `*` ranges.

## Runtime Resolution Model

The versioning module (`core/runtime/versioning`) adds:

- `CapabilityVersion`: semantic version parser/comparator.
- `VersionRange`: exact, caret, and wildcard range support.
- `VersionResolver`: deterministic provider matching.
- `CompatibilityChecker`: conflict and downgrade checks.
- `VersionSnapshot`: immutable inspector payload.

Resolution rules:

1. Candidate providers are filtered by consumer range.
2. Highest compatible version wins.
3. Ties on the same version are treated as ambiguous conflict.
4. Ambiguous or missing matches reject the consumer plugin.

## Runtime Integration

Version checks run after topology validation and before activation planning.

Integration points:

- topology graph capability provider metadata
- activation plan filtering for rejected plugins
- capability resolver provider selection per consumer
- diagnostics events:
  - `version:resolved`
  - `version:conflict`
  - `version:rejected`

## Inspector API

`runtime.getInspector().versions()` returns:

- `resolvedVersions`
- `compatibilityWarnings`
- `rejectedPlugins`

This snapshot is immutable and deterministic for the runtime state.
