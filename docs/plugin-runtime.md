# Plugin Runtime System

## Architecture first

Nimb CMS runtime treats plugins as executable capability units governed by contracts.
The runtime is infrastructure-only: it discovers plugin packages, validates contract declarations, executes registration lifecycle stages deterministically, and unloads plugin registrations through disposers.

Core remains domain-agnostic because runtime behavior depends only on manifest contracts and lifecycle entrypoints, not plugin content semantics.

## Runtime responsibilities

- Discover plugin descriptors from `/plugins` folder without executing plugin code.
- Validate manifest fields required for contract governance:
  - plugin `name`
  - plugin `version`
  - lifecycle entrypoint `entrypoints.register`
  - `declaredCapabilities`
  - `requiredPlatformContracts`
- Register and activate plugins through a deterministic sequence.
- Track plugin state via registry (`discovered`, `validated`, `active`, `failed`).
- Track and execute unload disposers for safe teardown.

## Lifecycle model

Runtime order is fixed and deterministic:

1. `discover`
2. `validate`
3. `register`
4. `activate`

If a plugin fails in any stage, that plugin is marked `failed` and processing continues for remaining plugins.
This guarantees isolation and prevents global platform failure.

## Safety guarantees

- Plugin failures are isolated per plugin record.
- Structured logging emits runtime event names and metadata only.
- Registration requires a disposer (or implicit noop disposer) to support safe unload.
- Unload reverses plugin-side registrations by invoking disposers in reverse activation order.

## Governance alignment

- **Domain-agnostic core:** runtime does not embed content-specific or plugin-specific rules.
- **Contract-only integration:** plugins receive only declared runtime contracts.
- **Determinism:** plugin discovery order and registry listing are sorted.
- **Failure containment:** a broken plugin cannot crash the platform lifecycle.
