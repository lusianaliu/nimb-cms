# Phase 44 — Standalone Runtime Mode

Phase 44 provides a deterministic production boot flow that runs Nimb CMS without Codex-specific execution paths.

## Install

```bash
npm install
```

## Run locally

```bash
node bin/nimb.js
```

You can also execute with the package binary mapping:

```bash
npx nimb
```

## Configuration

Nimb resolves configuration from the current project root (`process.cwd()`) using:

1. `./nimb.config.json`
2. built-in defaults from `core/config/config-loader.ts`

Environment variables are not used for config except `PORT`, which overrides `config.server.port`.

Example `nimb.config.json`:

```json
{
  "name": "nimb-app",
  "runtime": { "logLevel": "info", "mode": "development" },
  "server": { "port": 3000 },
  "admin": {
    "enabled": true,
    "basePath": "/admin",
    "staticDir": "./ui/admin"
  }
}
```

## Admin URL

When runtime is ready, open:

```text
http://localhost:<port>/<admin.basePath>
```

Default values:

- `port`: `3000`
- `admin.basePath`: `/admin`

## Health endpoint

Use the health endpoint for runtime verification:

```text
GET /health
```

Response:

```json
{
  "status": "ok",
  "runtime": "active"
}
```
