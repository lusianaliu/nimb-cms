# @nimblabs/plugin-content-basic

Reference plugin for architectural validation of Nimb CMS extension contracts.

## Purpose

This package intentionally avoids product features.
It demonstrates that content capability concepts can be introduced entirely through plugin contracts while core remains domain-agnostic.

## What it validates

- Explicit plugin manifest and contract requirements.
- Opaque capability registration for `content:create|read|update|delete`.
- Portable `article` schema registration (`title`, `body`, `status`).
- Isolated lifecycle hooks with deterministic ordering metadata.
- Reversible registration via disposer functions for clean unload.

## Non-goals

- No UI or theme integration.
- No direct internal imports from core.
- No persistence or production workflow behavior.
