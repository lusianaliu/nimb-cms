# Phase 212 — Preview Confidence Flow Milestone

## What changed

Nimb now provides an explicit admin-only preview flow for saved page and post entries:

- Edit Page now includes **Preview saved page**.
- Edit Post now includes **Preview saved post**.
- New preview routes were added:
  - `GET /admin/preview/pages/:id`
  - `GET /admin/preview/posts/:id`

These routes render content through the active public theme while keeping access behind the existing admin session middleware.

## Preview safety boundary

Preview is intentionally bounded:

- Drafts remain hidden from public routes (`/:slug` and `/blog/:slug`) until published.
- Preview routes are not public; anonymous access redirects to `/admin/login`.
- Preview includes the latest **saved** content only.
- Unsaved editor changes are not part of preview output.

A visible preview banner is injected to make this boundary explicit and avoid confusion with published output.

## Author workflow

1. Save as draft (or save draft changes).
2. Open the preview button from the edit screen.
3. Review the rendered result in theme context.
4. Publish when ready.

This gives authors a concrete review-before-publish step without exposing drafts publicly.
