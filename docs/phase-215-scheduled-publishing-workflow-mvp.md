# Phase 215 — Scheduled Publishing Workflow MVP

Phase 215 adds a bounded scheduled publishing flow for **posts** (blog workflow) without changing the core runtime architecture.

## What changed

- Post publishing now supports a practical scheduled state:
  - If a post is not a draft and has a `publishedAt` time in the future, Nimb treats it as **Scheduled**.
- Public routes (`/`, `/blog`, `/blog/:slug`) keep scheduled posts hidden until the scheduled time is reached.
- Admin post list now shows:
  - a **Scheduled** status pill when applicable,
  - a **Publish time** column so authors can verify what will publish and when.
- Admin notices now distinguish published vs scheduled outcomes:
  - `created-scheduled`
  - `updated-scheduled`
- Post editor guidance is clearer:
  - Draft remains private.
  - Future publish time + publish action means scheduled.
  - Time input uses server timezone.

## Author workflow (MVP)

1. Open **Posts → Write a new post**.
2. Enter title/slug/body.
3. Set **Publish date and time** to a future time.
4. Click **Publish now**.
5. Nimb stores the post but marks it as scheduled (hidden publicly until that time).
6. Verify scheduled state from Posts list (status + publish time).

## Visibility semantics

- **Draft**: hidden from public routes.
- **Scheduled** (post-only in Phase 215): hidden until `publishedAt` time.
- **Published**: visible on public routes.

## Scope limits (honest MVP)

- This phase covers scheduling for **posts** only.
- There is no editorial calendar view, bulk scheduling, notifications, or recurrence.
- Scheduling uses server time interpretation for `datetime-local` input.
- Automatic “status mutation” jobs are not introduced; visibility is resolved safely at read/render time.
