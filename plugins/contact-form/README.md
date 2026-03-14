# Contact Form Plugin (v2)

Simple plugin-owned contact form for Nimb CMS with storage-first submission handling and optional SMTP notifications.

## Features
- Public form at `/contact`
- Input validation (`name`, `email`, `message` required)
- Durable submission storage (source of truth)
- Admin review page at `/admin/contact-form`
- Mark submissions as read
- Plugin settings for form title, button text, and success message
- Basic anti-spam (honeypot + short submit cooldown)
- Optional SMTP notification email on successful submission storage

## SMTP notification settings
The plugin settings now include an optional notification section:
- `enabled`: toggle email notifications on/off
- `recipientEmail`: inbox that receives notification emails
- `fromName`: sender display name for notification email
- `fromEmail`: sender email address
- `smtpHost`: SMTP server hostname
- `smtpPort`: SMTP server port
- `smtpSecure`: use secure SMTP transport
- `smtpUsername`: SMTP username (optional)
- `smtpPassword`: SMTP password (optional)

Current phase stores SMTP credentials in plugin settings for practical setup speed. This is acceptable for now, but a future phase should move secrets to safer secret-management patterns.


## Notification health hint (Phase 173)
The plugin now tracks lightweight notification health metadata in the plugin settings entry:
- `lastNotificationAttemptAt`
- `lastNotificationStatus` (`never`, `success`, `failed`, `skipped`)
- `lastNotificationErrorSummary` (short and safe summary)
- `lastNotificationSkipReason`

This metadata is plugin-scoped and informational only. It is surfaced on the admin Contact Form settings screen as a concise health hint for operators.

Example hint states:
- notifications off
- notification settings incomplete
- last notification sent successfully
- last notification attempt failed (with short summary)

What this does **not** guarantee:
- It does not provide queue-based reliability.
- It does not guarantee inbox delivery.
- It is not a global/core mail monitoring subsystem.

Storage-first behavior is unchanged: submissions are still stored as the primary success path, and email remains best-effort.



## Per-submission notification status (Phase 174)
Each contact submission now stores compact notification metadata directly on the submission record:
- `notificationStatus` (`success`, `failed`, `skipped`, `unknown`)
- `notificationAttemptedAt`
- `notificationErrorSummary` (short safe summary)
- `notificationSkipReason`

Where admins see it:
- submissions list: small notification badge (`Sent`, `Failed`, `Skipped`, `Not attempted`)
- submission detail: badge plus plain-language explanation

Meaning of statuses:
- `success`: notification send attempt completed successfully
- `failed`: send attempt failed, but the message is still stored
- `skipped`: notifications were off or settings were incomplete, and message is still stored
- `unknown`: fallback for older records that predate this metadata

This metadata is intentionally lightweight and informational only. It does **not** guarantee inbox delivery and is **not** a full mail activity history.

## Notification status filter for submissions (Phase 175)
Admins can now filter the submissions list by notification outcome to speed up triage on busy sites.

Where to use it:
- Admin page: `/admin/contact-form`
- Location: top of the **Submissions** section (compact dropdown)

Filter options:
- `All`: show every saved submission
- `Sent`: show submissions where notification status is `success`
- `Failed`: show submissions where notification status is `failed`
- `Skipped`: show submissions where notification status is `skipped`
- `Not attempted`: show submissions where notification status is `unknown` (older/fallback records)

What the filter means:
- It is a read-only admin convenience for operational visibility.
- It helps quickly focus on sends that failed or were skipped.
- It uses existing per-submission notification metadata and badge wording.

What the filter does **not** do:
- It does not alter submission records.
- It does not retry notification sends.
- It does not introduce queue/workers or a global mail subsystem.

Storage-first contract remains unchanged:
- submissions are still saved as the primary success path
- notification status remains secondary, best-effort metadata

## Notification count summary for triage (Phase 176)
Admins now see a compact notification count summary near the submissions notification filter on `/admin/contact-form`.

What it shows:
- `Total`: all saved contact submissions in the plugin dataset (same set used by the admin list endpoint limit)
- `Failed`: submissions with notification status `failed`
- `Skipped`: submissions with notification status `skipped`
- `Sent`: submissions with notification status `success`

What counts represent:
- The summary is based on the **full saved submissions dataset**, not the currently selected filter result.
- If admins apply a filter (for example `Failed`), list rows change, but summary counts still describe the overall saved dataset so triage context remains visible.

Where admins see it:
- In the **Submissions** section, directly under the notification filter control.
- It is intentionally plain and lightweight (`Total · Failed · Skipped · Sent`) so it supports quick scanning without becoming a dashboard.

What this does **not** do:
- It does not change submission storage behavior.
- It does not retry or alter notification attempts.
- It does not add analytics infrastructure, charts, workers, or queue processing.

Storage-first remains intact:
- submissions are still the primary source of truth
- SMTP notification remains best-effort and secondary



## Count summary scope toggle (Phase 177)
The submissions notification summary now includes a tiny **Summary scope** toggle beside the existing notification filter on `/admin/contact-form`.

Scope options:
- `All saved submissions`: shows counts for the full saved contact-submission dataset (same plugin-scoped dataset used by the summary API).
- `Current filtered results`: shows counts for the currently loaded submissions list result after the selected notification filter is applied.

How current filtered results are calculated:
- The admin page fetches the submissions list using the active notification filter (`all`, `sent`, `failed`, `skipped`, `not-attempted`).
- The summary in `Current filtered results` scope is computed from that loaded list response in the admin UI.
- This keeps behavior compact and grounded in the existing list/filter flow without adding analytics infrastructure.

Important limits and intent:
- This is a triage clarity refinement, not a reporting dashboard.
- If existing list endpoints are capped in a future phase, filtered-scope counts reflect the loaded result set under that same cap.
- No storage semantics change: submissions remain primary and durable, SMTP remains best-effort.

What this does **not** do:
- It does not retry notifications.
- It does not add background workers, queue processing, charts, or broad analytics.
- It does not introduce a global/core mail subsystem.



## Summary scope microcopy clarification (Phase 178)
A small helper line now appears directly under the notification summary in the **Submissions** section on `/admin/contact-form`.

What it clarifies:
- In `All saved submissions` scope: counts describe all saved submissions in this contact form dataset.
- In `Current filtered results` scope: counts describe the filtered rows currently loaded in the submissions list.

Why this was added:
- It reduces ambiguity about what each scope represents without changing any summary math.
- It keeps wording calm and non-technical for non-technical admins.

What this does **not** do:
- It does not change summary/filter/list/storage behavior.
- It does not add analytics, dashboards, workers, or queue processing.

Storage-first remains unchanged:
- submission storage is still the primary success path
- SMTP notification remains best-effort and secondary

## Success / failure contract (storage-first)
Submission flow order:
1. Validate request payload.
2. Store submission in plugin-owned durable storage.
3. Attempt SMTP notification when notifications are enabled and settings are valid.
4. Return success to the visitor as long as storage succeeded.

Behavior matrix:
- Storage success + email success → success
- Storage success + email disabled/unconfigured → success
- Storage success + email failure → success (submission retained)
- Storage failure → failure

SMTP notification is intentionally a secondary layer and never the primary delivery path.

## Intentionally unsupported in v2
- Autoresponder email to submitter
- Multiple recipient routing logic
- Attachments
- Queue/worker-based delivery
- Full mail platform for all plugins
