# Phase 21 — Runtime Topology & Dependency Graph

## Intent

Introduce a runtime-owned topology layer that models plugin dependency relationships using capability contracts only.

## Delivered Runtime Module

New module path:

- `core/runtime/topology/`

Components:

- `TopologyGraph`: tracks plugin topology nodes, provider capabilities, and dependency edges.
- `DependencyResolver`: validates unresolved dependencies, duplicate providers, and circular dependency chains.
- `ActivationPlanner`: computes deterministic activation order using dependency edges and load-order fallback.
- `TopologySnapshot`: immutable inspector-facing runtime topology projection.

## Runtime Lifecycle Integration

The plugin runtime lifecycle now includes topology orchestration:

- **discover**: plugin descriptors are loaded and topology nodes are registered.
- **validate**: dependency validation runs against graph state before activation.
- **activate**: activation order follows deterministic planner output.

## Inspector & Diagnostics

- `runtime.getInspector().topology()` exposes:
  - `nodes`
  - `edges`
  - `activationOrder`
  - `unresolvedDependencies`
- Diagnostics events emitted:
  - `plugin.runtime.diagnostics.topology:build`
  - `plugin.runtime.diagnostics.topology:validated`
  - `plugin.runtime.diagnostics.topology:activationPlan`

## Determinism Guarantees

- Node and edge traversal are sorted and stable.
- Dependency cycle normalization is deterministic.
- Activation planning is topologically ordered with plugin discovery order tie-breaking.
- Topology snapshots are frozen read-only structures.
