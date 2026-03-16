# Phase 218 — Scheduled-Only Management View Milestone

Phase 218 adds a focused scheduled-management layer to the existing pages/posts list screens without introducing a calendar system.

## What changed

- **Pages list** now includes filter tabs:
  - `All pages`
  - `Scheduled only` (`/admin/pages?filter=scheduled`)
- **Posts list** now includes filter tabs:
  - `All posts`
  - `Scheduled only` (`/admin/posts?filter=scheduled`)
- The scheduled-only views are intentionally bounded and only include entries that are currently in real `scheduled` state, using the same publish timing semantics already used by status pills/public visibility.
- The dashboard scheduled queue now points authors to these scheduled-only list views for focused management.

## Author workflow

1. Use **Dashboard → Upcoming scheduled content** for cross-type visibility.
2. Move to **Pages → Scheduled only** or **Posts → Scheduled only** for focused operational review/editing.
3. Use the existing **Edit** action from each scheduled row to adjust content or publish timing.

## Scope and limits

- This is a management filter milestone, not a full editorial calendar.
- No destructive bulk actions were added.
- The dashboard queue remains an overview; list views remain the editing/management destination.
