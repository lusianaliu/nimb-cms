# Phase 217 — Scheduled Content Overview Queue Milestone

Phase 217 adds a lightweight author planning layer on top of existing scheduling semantics by introducing an **Upcoming scheduled content** queue on the admin dashboard.

## What changed

- Dashboard now includes a unified scheduled queue across **pages + posts**.
- Queue only shows entries currently in real `scheduled` state (based on existing status + publish timing semantics).
- Queue shows:
  - title,
  - content type (`Page` or `Post`),
  - status (`Scheduled`),
  - scheduled publish time,
  - quick edit link.
- Queue is ordered **soonest publish time first** and intentionally capped to a small list for clarity.
- Dashboard includes explicit scope note: this is a lightweight overview, not a full editorial calendar.

## Author workflow guidance

Use this path for scheduled publishing confidence:

1. Create/edit a page or post.
2. Choose **Publish now** with a future publish date/time.
3. Return to **Dashboard → Upcoming scheduled content** to confirm:
   - the item appears,
   - publish time is correct,
   - quick edit path works.
4. Use **Pages** and **Posts** list screens for full management and bulk review.

## What this does not replace

- It does not replace detailed Pages/Posts lists.
- It does not provide a calendar UI.
- It does not change scheduling semantics or public visibility rules.

This keeps the implementation bounded while making upcoming scheduled content materially easier to review.
