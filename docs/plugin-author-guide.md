# Nimb Plugin Author Guide (Canonical Path)

This guide documents the **active plugin path used by CMS bootstrap** (`core/plugin/plugin-loader.ts`).

## Canonical loading path

At runtime bootstrap, Nimb loads plugins from `<projectRoot>/plugins/*` when install state is runtime mode.

- Canonical loader: `core/plugin/plugin-loader.ts`
- Canonical bootstrap caller: `core/bootstrap/createBootstrap`

Compatibility loaders in `core/plugins/*` and `core/runtime/plugin-runtime/*` are internal/legacy and are not the startup path for CMS plugin loading.

## Plugin directory shape

Preferred plugin folder:

```txt
plugins/
  my-plugin/
    manifest.json
    index.ts
```

## Manifest contract (preferred)

Use `manifest.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "main": "index.ts"
}
```

Rules:
- `name` must be kebab-case and becomes plugin id.
- `version` must look like semver (`1.0.0`, `^1.0.0`, `~1.2.3`).
- `main` must be a relative path inside the plugin folder.

Compatibility manifest `plugin.json` is still accepted, but only for compatibility.

## Entrypoint contract

Preferred entrypoint shapes:

1. `export default function register(api) { ... }` (canonical)
2. `export default { setup(runtime) { ... } }` (supported)

Compatibility-only:
- `export function activate(runtime) { ... }`

## Plugin API surface (safe to depend on)

When using `default register(api)`, plugin receives:
- `api.version`
- `api.runtime`

`api.runtime` exposes:
- `contentTypes.register/get/list`
- `fieldTypes.register/get/list`
- `db.create/get/update/delete/list/query`
- `http.registerRoute` and `http.register`
- `admin.navRegistry.register/list`
- `admin.middleware.use/list`
- `hooks.register/execute`
- `events.on/off/emit`
- `settings.get/set/getAll/getSettings/updateSettings`
- `plugins.get/list`
- `capabilities`

Avoid depending on private runtime internals not in this scoped API.

## Collision safety

Nimb now fails fast for common collisions:
- Duplicate plugin id (plugin skipped with warning)
- Duplicate content type slug (throws)
- Duplicate field type name (throws)
- Duplicate admin nav item id (throws)
- Duplicate plugin route key (`METHOD path`) (throws)

Errors include plugin id context to improve debugging.

## Common mistakes

- Manifest uses unknown fields.
- Manifest entry path points outside plugin directory.
- Entrypoint exports unsupported shape.
- Unsupported route method (must be GET/POST/PUT/DELETE).
- Missing required capabilities for settings operations.

## Stability boundary

Safe plugin-facing boundary:
- `core/plugin/plugin-loader.ts` contract behavior.
- `core/plugin/plugin-manifest.ts` accepted manifest shapes.
- `ScopedRuntime` surface from `core/plugin/plugin-api.ts`.

Internal areas (avoid coupling):
- `core/plugins/*` legacy loader path.
- `core/runtime/plugin-runtime/*` runtime-internal plugin engine modules.
- Bootstrap internals outside exposed plugin API.
