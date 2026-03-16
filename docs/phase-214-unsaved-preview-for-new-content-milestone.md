# Phase 214 — Unsaved Preview for New Content Milestone

Phase 214 closes the biggest remaining preview-confidence gap from Phase 213 by adding unsaved preview support to **create-new** page and post forms.

## What changed

- Create page now includes **Preview unsaved page**.
- Create post now includes **Preview unsaved post**.
- New admin-only endpoints render unsaved create-form buffers in the active public theme without persistence:
  - `POST /admin/preview/pages/new/unsaved`
  - `POST /admin/preview/posts/new/unsaved`
- Existing edit-mode unsaved preview endpoints remain unchanged:
  - `POST /admin/preview/pages/:id/unsaved`
  - `POST /admin/preview/posts/:id/unsaved`
- Existing saved preview links remain unchanged for existing entries:
  - `GET /admin/preview/pages/:id`
  - `GET /admin/preview/posts/:id`

## Author workflow

1. Open `/admin/pages/new` or `/admin/posts/new`.
2. Enter draft content in the form/editor.
3. Select **Preview unsaved page/post** to open a new tab in active theme context.
4. Continue editing and use **Save as draft** or **Publish now** explicitly when ready.

## Safety and boundaries

- New-entry unsaved preview is **admin-auth protected**.
- New-entry unsaved preview is **non-persistent** and does not create an entry.
- New-entry unsaved preview does **not** publish content.
- Public routes still do not expose unsaved create-form buffers.

## Current limits

- New-entry unsaved preview remains an in-request admin preview, not a shareable preview link.
- There is still no collaborative or external reviewer preview-sharing flow.
