# Phase 216 — Scheduled Publishing Parity for Pages + Unified Status Semantics

Phase 216 extends scheduled publishing semantics from posts to pages so authors can trust the same meaning of **Draft / Scheduled / Published** across both content types.

## What changed

- Pages now support an optional **Publish date and time** field in admin create/edit forms.
- When a page is set to **Published** with a future publish time, it resolves to **Scheduled**:
  - shown as **Scheduled** in the Pages list status pill,
  - surfaced with scheduled notices (`created-scheduled`, `updated-scheduled`),
  - hidden from public routes and page navigation until publish time.
- Draft pages remain non-public as before.
- Published pages with past/empty publish time remain public.

## Author workflow (pages)

1. Go to **Admin → Pages → Create a new page** (or edit an existing page).
2. Choose **Publish status**:
   - **Draft** keeps the page hidden.
   - **Published** can publish immediately or schedule for later based on publish time.
3. Optionally set **Publish date and time**.
4. Click **Publish now**:
   - future time → page is scheduled and hidden until that time,
   - past/empty time → page is published immediately.

## Semantics parity with posts

Pages and posts now share the same visible status resolution behavior:

- `draft` → **Draft**, not public
- `published` + future `publishedAt` → **Scheduled**, not public yet
- `published` + past/empty `publishedAt` → **Published**, public

## Current MVP limits

- Scheduling remains intentionally simple: one publish timestamp per entry.
- No editorial calendar, recurrence, notifications, or approval workflow in this phase.
- Time interpretation follows server-side datetime handling and is surfaced in form help copy.
