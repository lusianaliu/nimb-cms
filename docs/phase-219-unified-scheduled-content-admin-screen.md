# Phase 219 — Unified Scheduled Content Admin Screen Milestone

Phase 219 adds a dedicated **Scheduled Content** admin screen at `/admin/scheduled` so authors can manage upcoming scheduled pages and posts from one place.

## What changed

- Added a new admin route: `/admin/scheduled`.
- Added a new nav item: **Scheduled** in the admin sidebar.
- Added a unified cross-type scheduled table with:
  - title
  - content type (Page/Post)
  - status (Scheduled)
  - scheduled publish time
  - quick edit link to the correct page/post editor
- Kept behavior non-destructive (review + edit routing only).
- Updated the dashboard scheduled queue guidance to point authors to `/admin/scheduled` for central management while preserving type-specific scheduled filters.

## Author workflow now

1. Use **Dashboard → Upcoming scheduled content** for at-a-glance awareness.
2. Open **Scheduled** in admin navigation (or `/admin/scheduled`) to review all scheduled pages and posts in one operational list.
3. Use **Edit page/post** quick action from each row for schedule/content adjustments.
4. Keep using **Pages → Scheduled only** and **Posts → Scheduled only** when type-specific filtering is preferred.

## Scope and limits

- This is a bounded management surface, not a full editorial calendar.
- No bulk destructive actions were added.
- Sorting is by soonest scheduled publish time first, based on the same scheduling semantics already used by pages/posts/dashboard.
