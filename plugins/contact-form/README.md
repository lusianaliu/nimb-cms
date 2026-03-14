# Contact Form Plugin (v1)

Simple plugin-owned contact form for Nimb CMS.

## Features
- Public form at `/contact`
- Input validation (`name`, `email`, `message` required)
- Durable submission storage
- Admin review page at `/admin/contact-form`
- Mark submissions as read
- Plugin settings for form title, button text, and success message
- Basic anti-spam (honeypot + short submit cooldown)

## Explicitly out of scope
- SMTP/email sending
- multiple forms
- file uploads
- third-party CAPTCHA
