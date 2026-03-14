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
