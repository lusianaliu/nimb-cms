# Phase 171 — Simple Contact Form Plugin v1 (Store Submissions Only)

## Summary
Phase 171 adds a plugin-first contact form capability through a dedicated plugin at `plugins/contact-form`.
The plugin provides a public form, durable submission storage, admin review flows, and small plugin-owned settings.

## Plugin structure
- `plugins/contact-form/manifest.json` — canonical plugin manifest for loader discovery.
- `plugins/contact-form/index.ts` — plugin registration entrypoint.

## Routes added
### Public routes
- `GET /contact` — render contact form.
- `POST /contact` — validate and submit form.

### Admin API routes
- `GET /admin-api/contact-form/settings` — read plugin settings.
- `PUT /admin-api/contact-form/settings` — update plugin settings.
- `GET /admin-api/contact-form/submissions` — list submissions.
- `GET /admin-api/contact-form/submissions/:id` — read one submission.
- `POST /admin-api/contact-form/submissions/:id/read` — mark one submission as read.

### Admin page
- `/admin/contact-form` — plugin admin screen for settings and submission review.

## Storage model
The plugin uses plugin-owned content types through the existing runtime DB proxy:
- `contact-submission`
  - fields: `name`, `email`, `subject`, `message`, `status`, `createdAt`
  - status values in v1: `new`, `read`
- `contact-form-settings`
  - fields: `formTitle`, `submitButtonText`, `successMessage`

Submissions are the source of truth in this phase; no SMTP or outbound mail is used.

## Admin review behavior
The admin screen provides:
- submissions list
- submission detail
- mark-as-read action
- inline settings form

The plugin registers both admin nav metadata and admin menu/page hooks to align with the current admin shell behavior.

## Validation and anti-spam
Validation in v1:
- required `name`
- required `email`
- email format check
- required `message`
- trim normalization for text fields
- `subject` is optional

Anti-spam in v1:
- honeypot field (`website`)
- minimal per-client cooldown (10 seconds)

## Non-goals preserved
This phase intentionally does not add:
- form builder UX
- multiple forms
- SMTP/email sending
- file uploads
- external anti-spam services

## Future v2 ideas
- optional SMTP/email notifications
- multiple named forms
- stronger anti-spam controls
- export and filtering in admin
