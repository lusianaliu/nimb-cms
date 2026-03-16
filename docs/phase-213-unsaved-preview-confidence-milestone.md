# Phase 213 — Unsaved Preview Confidence Milestone

Phase 213 adds a bounded preview path for unsaved edits in both page and post edit screens.

## What changed

- Page edit now includes **Preview unsaved changes**.
- Post edit now includes **Preview unsaved changes**.
- Each unsaved preview submits the current form buffer to an admin-only preview endpoint:
  - `POST /admin/preview/pages/:id/unsaved`
  - `POST /admin/preview/posts/:id/unsaved`
- Unsaved preview renders through the active public theme and shows a visible **Unsaved preview mode** banner.
- Existing saved preview links remain unchanged:
  - `GET /admin/preview/pages/:id`
  - `GET /admin/preview/posts/:id`

## Author workflow

1. Open an existing page or post in `/admin` edit view.
2. Make edits in the form/editor.
3. Select **Preview unsaved changes** to open a new tab with the current unsaved buffer.
4. Use **Preview saved page/post** when you want to compare with the currently persisted version.
5. Save draft or publish explicitly using existing workflow buttons.

## Safety and boundaries

- Unsaved preview is **admin-auth protected** (same admin middleware as other admin routes).
- Unsaved preview is **not persisted** automatically.
- Unsaved preview does **not** publish content.
- Public routes still show only published content, and draft privacy behavior remains unchanged.

## Current limits

- Unsaved preview currently applies to **edit** routes for existing entries.
- “Create new page/post” forms still require initial save before preview is available.
