# Phase 32 — Runtime Bootstrap & Local Installation

Phase 32 introduces a deterministic bootstrap layer that turns Nimb runtime components into a runnable local application.

## Bootstrap architecture

The bootstrap system lives in `core/bootstrap/`:

- `config-loader.ts`: loads and normalizes `nimb.config.json`.
- `runtime-factory.ts`: creates a fully wired `PluginRuntime` instance.
- `bootstrap.ts`: executes deterministic startup flow.
- `bootstrap-snapshot.ts`: creates immutable startup snapshot payloads.
- `index.ts`: module exports.

## Startup lifecycle

`createBootstrap()` follows a deterministic order:

1. Load and freeze runtime config.
2. Construct runtime dependencies with explicit wiring.
3. Start `PluginRuntime` lifecycle.
4. Capture immutable `BootstrapSnapshot` diagnostics.
5. Publish bootstrap snapshot through runtime inspector.

No global singletons are used and no HTTP server is started in this phase.

## Configuration model

`nimb.config.json` is loaded from the current project root.

Supported fields:

- `name` (string)
- `plugins` (string array)
- `runtime.logLevel` (`debug|info|warn|error`)
- `runtime.mode` (string)

If the file is missing, defaults are used:

```json
{
  "name": "nimb-app",
  "plugins": [],
  "runtime": {
    "logLevel": "info",
    "mode": "development"
  }
}
```

Config output is normalized, validated, and deep frozen.

## Determinism guarantees

Determinism is preserved by:

- sorted plugin identifiers
- stable snapshot serialization and config hashing
- immutable bootstrap snapshots
- inspector fallback snapshot when bootstrap has not run yet

## CLI usage

A runtime CLI entrypoint is available at `bin/nimb.js`.

Run:

```bash
node bin/nimb.js
```

or:

```bash
npm start
```

Expected output format:

```text
Nimb Runtime Started
status: healthy|degraded
plugins: <count>
mode: development
```
