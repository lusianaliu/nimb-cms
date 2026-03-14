import net from 'node:net';
import tls from 'node:tls';

const CONTACT_SUBMISSION_TYPE = 'contact-submission';
const CONTACT_SETTINGS_TYPE = 'contact-form-settings';
const SPAM_COOLDOWN_MS = 10_000;

type ContactNotificationSettings = {
  enabled: boolean;
  recipientEmail: string;
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
};

type ContactSettings = {
  formTitle: string;
  submitButtonText: string;
  successMessage: string;
  notification: ContactNotificationSettings;
  notificationHealth: ContactNotificationHealth;
};

type ContactNotificationHealthStatus = 'success' | 'failed' | 'skipped' | 'never';

type ContactNotificationHealth = {
  lastNotificationAttemptAt: string;
  lastNotificationStatus: ContactNotificationHealthStatus;
  lastNotificationErrorSummary: string;
  lastNotificationSkipReason: string;
};

type ContactFormValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

type ContactSubmissionNotificationStatus = 'success' | 'failed' | 'skipped' | 'unknown';
type ContactSubmissionNotificationFilter = 'all' | 'sent' | 'failed' | 'skipped' | 'not-attempted';

type ContactSubmissionNotificationCounts = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  notAttempted: number;
};

type ContactSubmissionNotificationState = {
  status: ContactSubmissionNotificationStatus;
  attemptedAt: string;
  errorSummary: string;
  skipReason: string;
};

const DEFAULT_SETTINGS: ContactSettings = Object.freeze({
  formTitle: 'Contact Us',
  submitButtonText: 'Send Message',
  successMessage: 'Thanks for your message. We will review it soon.',
  notification: {
    enabled: false,
    recipientEmail: '',
    fromName: 'Nimb CMS Contact Form',
    fromEmail: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUsername: '',
    smtpPassword: ''
  },
  notificationHealth: {
    lastNotificationAttemptAt: '',
    lastNotificationStatus: 'never',
    lastNotificationErrorSummary: '',
    lastNotificationSkipReason: ''
  }
});

const escapeHtml = (value: unknown): string => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const trimText = (value: unknown) => `${value ?? ''}`.trim();
const normalizeText = (value: unknown, fallback: string) => {
  const trimmed = trimText(value);
  return trimmed || fallback;
};

const normalizeBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  const text = `${value ?? ''}`.trim().toLowerCase();
  if (text === 'true' || text === '1' || text === 'on' || text === 'yes') {
    return true;
  }
  if (text === 'false' || text === '0' || text === 'off' || text === 'no') {
    return false;
  }

  return fallback;
};

const normalizePort = (value: unknown, fallback: number) => {
  const asNumber = Number.parseInt(`${value ?? ''}`.trim(), 10);
  if (Number.isFinite(asNumber) && asNumber > 0 && asNumber <= 65_535) {
    return asNumber;
  }

  return fallback;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeNotificationSettings = (value: unknown): ContactNotificationSettings => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    enabled: normalizeBoolean(source.enabled, DEFAULT_SETTINGS.notification.enabled),
    recipientEmail: trimText(source.recipientEmail).toLowerCase(),
    fromName: normalizeText(source.fromName, DEFAULT_SETTINGS.notification.fromName),
    fromEmail: trimText(source.fromEmail).toLowerCase(),
    smtpHost: trimText(source.smtpHost),
    smtpPort: normalizePort(source.smtpPort, DEFAULT_SETTINGS.notification.smtpPort),
    smtpSecure: normalizeBoolean(source.smtpSecure, DEFAULT_SETTINGS.notification.smtpSecure),
    smtpUsername: trimText(source.smtpUsername),
    smtpPassword: trimText(source.smtpPassword)
  };
};

const normalizeNotificationSettingsFromRecord = (entryData: Record<string, unknown> | null | undefined) => {
  const notificationSource = entryData?.notification && typeof entryData.notification === 'object'
    ? entryData.notification as Record<string, unknown>
    : {};

  return normalizeNotificationSettings({
    enabled: entryData?.notificationEnabled ?? notificationSource.enabled,
    recipientEmail: entryData?.notificationRecipientEmail ?? notificationSource.recipientEmail,
    fromName: entryData?.notificationFromName ?? notificationSource.fromName,
    fromEmail: entryData?.notificationFromEmail ?? notificationSource.fromEmail,
    smtpHost: entryData?.smtpHost ?? notificationSource.smtpHost,
    smtpPort: entryData?.smtpPort ?? notificationSource.smtpPort,
    smtpSecure: entryData?.smtpSecure ?? notificationSource.smtpSecure,
    smtpUsername: entryData?.smtpUsername ?? notificationSource.smtpUsername,
    smtpPassword: entryData?.smtpPassword ?? notificationSource.smtpPassword
  });
};

const toStoredSettings = (settings: ContactSettings) => ({
  formTitle: settings.formTitle,
  submitButtonText: settings.submitButtonText,
  successMessage: settings.successMessage,
  notificationEnabled: settings.notification.enabled,
  notificationRecipientEmail: settings.notification.recipientEmail,
  notificationFromName: settings.notification.fromName,
  notificationFromEmail: settings.notification.fromEmail,
  smtpHost: settings.notification.smtpHost,
  smtpPort: settings.notification.smtpPort,
  smtpSecure: settings.notification.smtpSecure,
  smtpUsername: settings.notification.smtpUsername,
  smtpPassword: settings.notification.smtpPassword,
  lastNotificationAttemptAt: settings.notificationHealth.lastNotificationAttemptAt,
  lastNotificationStatus: settings.notificationHealth.lastNotificationStatus,
  lastNotificationErrorSummary: settings.notificationHealth.lastNotificationErrorSummary,
  lastNotificationSkipReason: settings.notificationHealth.lastNotificationSkipReason
});

const normalizeNotificationHealthFromRecord = (entryData: Record<string, unknown> | null | undefined): ContactNotificationHealth => {
  const statusText = trimText(entryData?.lastNotificationStatus).toLowerCase();
  const status: ContactNotificationHealthStatus = statusText === 'success'
    || statusText === 'failed'
    || statusText === 'skipped'
    || statusText === 'never'
    ? statusText
    : 'never';

  return {
    lastNotificationAttemptAt: trimText(entryData?.lastNotificationAttemptAt),
    lastNotificationStatus: status,
    lastNotificationErrorSummary: trimText(entryData?.lastNotificationErrorSummary),
    lastNotificationSkipReason: trimText(entryData?.lastNotificationSkipReason)
  };
};

const summarizeNotificationError = (error: unknown) => {
  const raw = error instanceof Error ? error.message : `${error ?? ''}`;
  const collapsed = raw.trim().replaceAll(/\s+/g, ' ');
  if (!collapsed) {
    return 'Notification send failed.';
  }

  return collapsed.slice(0, 160);
};

const normalizeSubmissionNotificationState = (recordData: Record<string, unknown> | null | undefined): ContactSubmissionNotificationState => {
  const statusText = trimText(recordData?.notificationStatus).toLowerCase();
  const status: ContactSubmissionNotificationStatus = statusText === 'success'
    || statusText === 'failed'
    || statusText === 'skipped'
    || statusText === 'unknown'
    ? statusText
    : 'unknown';

  return {
    status,
    attemptedAt: trimText(recordData?.notificationAttemptedAt),
    errorSummary: trimText(recordData?.notificationErrorSummary),
    skipReason: trimText(recordData?.notificationSkipReason)
  };
};

const toNotificationStatusView = (state: ContactSubmissionNotificationState) => {
  if (state.status === 'success') {
    return {
      badgeLabel: 'Sent',
      detailText: state.attemptedAt
        ? `Notification sent at ${state.attemptedAt}.`
        : 'Notification sent.',
      tone: 'positive'
    };
  }

  if (state.status === 'failed') {
    const summary = state.errorSummary ? ` (${state.errorSummary})` : '';
    return {
      badgeLabel: 'Failed',
      detailText: `Notification failed. The message is still saved${summary}.`,
      tone: 'warning'
    };
  }

  if (state.status === 'skipped') {
    const reason = state.skipReason || 'email settings were not ready';
    return {
      badgeLabel: 'Skipped',
      detailText: `Notification skipped because ${reason}. The message is still saved.`,
      tone: 'neutral'
    };
  }

  return {
    badgeLabel: 'Not attempted',
    detailText: 'Notification has not been attempted yet. The message is still saved.',
    tone: 'neutral'
  };
};

const normalizeNotificationFilter = (value: unknown): ContactSubmissionNotificationFilter => {
  const filterText = trimText(value).toLowerCase();
  if (filterText === 'sent' || filterText === 'failed' || filterText === 'skipped' || filterText === 'not-attempted') {
    return filterText;
  }

  return 'all';
};

const matchesNotificationFilter = (status: ContactSubmissionNotificationStatus, filter: ContactSubmissionNotificationFilter): boolean => {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'sent') {
    return status === 'success';
  }

  if (filter === 'failed') {
    return status === 'failed';
  }

  if (filter === 'skipped') {
    return status === 'skipped';
  }

  return status === 'unknown';
};

const countSubmissionNotifications = (summaries: Array<{ notificationStatus: ContactSubmissionNotificationStatus }>): ContactSubmissionNotificationCounts => {
  const counts: ContactSubmissionNotificationCounts = {
    total: summaries.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    notAttempted: 0
  };

  for (const summary of summaries) {
    if (summary.notificationStatus === 'success') {
      counts.sent += 1;
      continue;
    }

    if (summary.notificationStatus === 'failed') {
      counts.failed += 1;
      continue;
    }

    if (summary.notificationStatus === 'skipped') {
      counts.skipped += 1;
      continue;
    }

    counts.notAttempted += 1;
  }

  return counts;
};

const buildNotificationHealthHint = (settings: ContactSettings) => {
  if (!settings.notification.enabled) {
    return {
      tone: 'neutral',
      message: 'Email notifications are off. Messages are still stored in admin.'
    };
  }

  if (!isValidNotificationSettings(settings.notification)) {
    return {
      tone: 'warning',
      message: 'Notification settings are incomplete. Messages are still stored in admin.'
    };
  }

  const attemptAt = settings.notificationHealth.lastNotificationAttemptAt;
  if (settings.notificationHealth.lastNotificationStatus === 'success') {
    return {
      tone: 'positive',
      message: attemptAt
        ? `Last notification was sent successfully at ${attemptAt}.`
        : 'Last notification was sent successfully.'
    };
  }

  if (settings.notificationHealth.lastNotificationStatus === 'failed') {
    const suffix = settings.notificationHealth.lastNotificationErrorSummary
      ? ` (${settings.notificationHealth.lastNotificationErrorSummary})`
      : '';
    return {
      tone: 'warning',
      message: `Last notification attempt failed${suffix}. New messages are still being saved.`
    };
  }

  if (settings.notificationHealth.lastNotificationStatus === 'skipped') {
    const reason = settings.notificationHealth.lastNotificationSkipReason || 'send conditions were not met';
    return {
      tone: 'neutral',
      message: `Last notification was skipped because ${reason}. Messages are still stored in admin.`
    };
  }

  return {
    tone: 'neutral',
    message: 'Notification is enabled. No delivery attempt has been recorded yet.'
  };
};

const isValidNotificationSettings = (settings: ContactNotificationSettings) => {
  if (!settings.enabled) {
    return false;
  }

  return EMAIL_PATTERN.test(settings.recipientEmail)
    && EMAIL_PATTERN.test(settings.fromEmail)
    && Boolean(settings.smtpHost)
    && Number.isFinite(settings.smtpPort);
};

const createNotificationText = (submission: { name: string, email: string, subject: string, message: string, createdAt: string }) => {
  const submittedSubject = submission.subject || '(no subject)';
  return [
    'New contact form submission',
    '',
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    `Subject: ${submittedSubject}`,
    `Submitted at: ${submission.createdAt}`,
    '',
    'Message:',
    submission.message
  ].join('\n');
};

const withSmtpDotStuffing = (value: string) => value
  .replaceAll('\r\n', '\n')
  .replaceAll('\r', '\n')
  .split('\n')
  .map((line) => (line.startsWith('.') ? `.${line}` : line))
  .join('\r\n');

const toSmtpAddress = (email: string) => `<${email}>`;

const createNotificationRawEmail = ({
  settings,
  submission
}: {
  settings: ContactNotificationSettings;
  submission: { name: string, email: string, subject: string, message: string, createdAt: string };
}) => {
  const subject = submission.subject
    ? `New contact form submission: ${submission.subject}`
    : 'New contact form submission';
  const body = withSmtpDotStuffing(createNotificationText(submission));

  return [
    `From: ${settings.fromName} <${settings.fromEmail}>`,
    `To: ${settings.recipientEmail}`,
    `Reply-To: ${submission.email}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    ''
  ].join('\r\n');
};

const sendSmtpNotification = async ({
  settings,
  submission
}: {
  settings: ContactNotificationSettings;
  submission: { name: string, email: string, subject: string, message: string, createdAt: string };
}) => {
  await new Promise<void>((resolve, reject) => {
    const socket = settings.smtpSecure
      ? tls.connect({ host: settings.smtpHost, port: settings.smtpPort, servername: settings.smtpHost })
      : net.createConnection({ host: settings.smtpHost, port: settings.smtpPort });

    socket.setEncoding('utf8');
    socket.setTimeout(2_500);

    let buffer = '';
    let awaiting: { resolve: (value: string) => void, reject: (error: Error) => void } | null = null;

    const cleanup = () => {
      socket.removeAllListeners('data');
      socket.removeAllListeners('error');
      socket.removeAllListeners('timeout');
      socket.removeAllListeners('close');
    };

    const fail = (message: string) => {
      cleanup();
      socket.destroy();
      reject(new Error(message));
    };

    const complete = () => {
      cleanup();
      socket.end();
      resolve();
    };

    const readResponse = () => new Promise<string>((resolveRead, rejectRead) => {
      awaiting = { resolve: resolveRead, reject: rejectRead };
      const lines = buffer.split('\r\n').filter(Boolean);
      const last = lines.at(-1);
      if (last && /^\d{3}\s/.test(last)) {
        const chunk = buffer;
        buffer = '';
        awaiting = null;
        resolveRead(chunk);
      }
    });

    const writeCommand = async (command: string, expectedCodePrefix = '2') => {
      socket.write(`${command}\r\n`);
      const response = await readResponse();
      if (!response.trim().startsWith(expectedCodePrefix)) {
        throw new Error(`SMTP command failed (${command}): ${response.trim()}`);
      }
    };

    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (!awaiting) {
        return;
      }

      const lines = buffer.split('\r\n').filter(Boolean);
      const last = lines.at(-1);
      if (!last || !/^\d{3}\s/.test(last)) {
        return;
      }

      const pending = awaiting;
      awaiting = null;
      const response = buffer;
      buffer = '';
      pending.resolve(response);
    });

    socket.on('error', (error) => {
      if (awaiting) {
        awaiting.reject(error instanceof Error ? error : new Error(`${error ?? 'SMTP socket error'}`));
        awaiting = null;
      }
      fail(`SMTP socket error: ${error instanceof Error ? error.message : `${error ?? ''}`}`);
    });

    socket.on('timeout', () => {
      fail('SMTP socket timeout');
    });

    socket.on('close', () => {
      if (awaiting) {
        awaiting.reject(new Error('SMTP socket closed unexpectedly'));
        awaiting = null;
      }
    });

    const run = async () => {
      await readResponse();
      await writeCommand('EHLO nimb-cms');

      if (settings.smtpUsername) {
        await writeCommand(`AUTH LOGIN`, '3');
        await writeCommand(Buffer.from(settings.smtpUsername, 'utf8').toString('base64'), '3');
        await writeCommand(Buffer.from(settings.smtpPassword, 'utf8').toString('base64'));
      }

      await writeCommand(`MAIL FROM:${toSmtpAddress(settings.fromEmail)}`);
      await writeCommand(`RCPT TO:${toSmtpAddress(settings.recipientEmail)}`);
      await writeCommand('DATA', '3');

      const rawEmail = createNotificationRawEmail({ settings, submission });
      socket.write(`${rawEmail}\r\n.\r\n`);
      const dataResult = await readResponse();
      if (!dataResult.trim().startsWith('2')) {
        throw new Error(`SMTP DATA failed: ${dataResult.trim()}`);
      }

      socket.write('QUIT\r\n');
      complete();
    };

    void run().catch((error) => {
      fail(error instanceof Error ? error.message : `${error ?? 'SMTP send failed'}`);
    });
  });
};

const readBodyText = async (request: AsyncIterable<unknown>) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(`${chunk ?? ''}`));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const readUrlEncodedBody = async (request: AsyncIterable<unknown>): Promise<Record<string, string>> => {
  const text = await readBodyText(request);
  return Object.fromEntries(new URLSearchParams(text));
};

const readJsonBody = async (request: AsyncIterable<unknown>): Promise<Record<string, unknown>> => {
  const text = await readBodyText(request);
  if (!text.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const getClientAddress = (request) => {
  const forwarded = `${request?.headers?.['x-forwarded-for'] ?? ''}`.split(',')[0]?.trim();
  if (forwarded) {
    return forwarded;
  }

  return `${request?.socket?.remoteAddress ?? 'unknown'}`;
};

const toHtmlResponse = (html: string, statusCode = 200) => ({
  statusCode,
  send(response) {
    const body = Buffer.from(html, 'utf8');
    response.writeHead(statusCode, {
      'content-length': body.byteLength,
      'content-type': 'text/html; charset=utf-8'
    });
    response.end(body);
  }
});

const toJsonResponse = (payload: unknown, statusCode = 200) => ({
  statusCode,
  send(response) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    response.writeHead(statusCode, {
      'content-length': body.byteLength,
      'content-type': 'application/json; charset=utf-8'
    });
    response.end(body);
  }
});

const toRedirect = (location: string) => ({
  statusCode: 302,
  send(response) {
    response.writeHead(302, { location, 'content-length': '0' });
    response.end();
  }
});

const renderPublicForm = ({
  settings,
  values,
  errors,
  successNotice
}: {
  settings: ContactSettings;
  values: ContactFormValues;
  errors: string[];
  successNotice?: string;
}) => {
  const errorMarkup = errors.length > 0
    ? `<div style="margin-bottom:1rem;padding:.75rem;border:1px solid #fecaca;background:#fef2f2;border-radius:10px;color:#991b1b;"><strong>Please fix the following:</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></div>`
    : '';
  const successMarkup = successNotice
    ? `<div style="margin-bottom:1rem;padding:.75rem;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;color:#166534;">${escapeHtml(successNotice)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(settings.formTitle)}</title>
    <style>
      body { font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; background: #f8fafc; color: #1f2937; }
      .shell { width: min(100% - 2rem, 760px); margin: 2rem auto; }
      .panel { background: #fff; border: 1px solid #dbe4ee; border-radius: 12px; padding: 1rem; }
      label { display: block; margin-bottom: .35rem; font-weight: 600; }
      input, textarea { width: 100%; padding: .6rem; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: .9rem; font: inherit; }
      textarea { min-height: 140px; resize: vertical; }
      button { border: 1px solid #0f4c81; background: #0f4c81; color: #fff; border-radius: 8px; padding: .6rem .9rem; font: inherit; cursor: pointer; }
      .muted { color: #64748b; font-size: .95rem; }
      .honeypot { position: absolute; left: -10000px; width: 1px; height: 1px; opacity: 0; }
      a { color: #0f4c81; }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="panel">
        <h1>${escapeHtml(settings.formTitle)}</h1>
        <p class="muted">Use this form to send us your message.</p>
        ${successMarkup}
        ${errorMarkup}
        <form method="POST" action="/contact" novalidate>
          <label for="name">Name</label>
          <input id="name" name="name" value="${escapeHtml(values.name)}" required />

          <label for="email">Email</label>
          <input id="email" name="email" type="email" value="${escapeHtml(values.email)}" required />

          <label for="subject">Subject (optional)</label>
          <input id="subject" name="subject" value="${escapeHtml(values.subject)}" />

          <label for="message">Message</label>
          <textarea id="message" name="message" required>${escapeHtml(values.message)}</textarea>

          <div class="honeypot" aria-hidden="true">
            <label for="website">Website</label>
            <input id="website" name="website" value="${escapeHtml(values.website)}" autocomplete="off" tabindex="-1" />
          </div>

          <button type="submit">${escapeHtml(settings.submitButtonText)}</button>
        </form>
        <p class="muted" style="margin-top:1rem;"><a href="/">Back to homepage</a></p>
      </section>
    </main>
  </body>
</html>`;
};

const renderAdminPage = () => `
  <section>
    <h1>Contact Form</h1>
    <p>Review visitor messages and update contact form settings.</p>

    <section style="margin:1rem 0;padding:1rem;border:1px solid #dbe4ee;border-radius:12px;background:#fff;">
      <h2 style="margin-top:0;">Settings</h2>
      <form id="contact-settings-form">
        <label style="display:block;margin-bottom:.4rem;">Form title</label>
        <input name="formTitle" style="width:100%;padding:.55rem;margin-bottom:.75rem;" />
        <label style="display:block;margin-bottom:.4rem;">Submit button text</label>
        <input name="submitButtonText" style="width:100%;padding:.55rem;margin-bottom:.75rem;" />
        <label style="display:block;margin-bottom:.4rem;">Success message</label>
        <textarea name="successMessage" style="width:100%;padding:.55rem;min-height:90px;"></textarea>
        <hr style="margin:1rem 0;border:none;border-top:1px solid #dbe4ee;" />
        <p style="margin:0 0 .6rem;color:#334155;">Submissions are always stored first. SMTP email is an optional notification layer.</p>
        <label style="display:flex;align-items:center;gap:.45rem;margin-bottom:.75rem;">
          <input type="checkbox" name="notificationEnabled" />
          Enable email notifications
        </label>
        <label style="display:block;margin-bottom:.4rem;">Notification recipient email</label>
        <input name="recipientEmail" type="email" style="width:100%;padding:.55rem;margin-bottom:.75rem;" placeholder="owner@example.com" />
        <label style="display:block;margin-bottom:.4rem;">From name</label>
        <input name="fromName" style="width:100%;padding:.55rem;margin-bottom:.75rem;" placeholder="Nimb CMS Contact Form" />
        <label style="display:block;margin-bottom:.4rem;">From email</label>
        <input name="fromEmail" type="email" style="width:100%;padding:.55rem;margin-bottom:.75rem;" placeholder="no-reply@example.com" />
        <label style="display:block;margin-bottom:.4rem;">SMTP host</label>
        <input name="smtpHost" style="width:100%;padding:.55rem;margin-bottom:.75rem;" placeholder="smtp.example.com" />
        <label style="display:block;margin-bottom:.4rem;">SMTP port</label>
        <input name="smtpPort" type="number" min="1" max="65535" style="width:100%;padding:.55rem;margin-bottom:.75rem;" placeholder="587" />
        <label style="display:flex;align-items:center;gap:.45rem;margin-bottom:.75rem;">
          <input type="checkbox" name="smtpSecure" />
          Use secure SMTP (TLS)
        </label>
        <label style="display:block;margin-bottom:.4rem;">SMTP username (optional)</label>
        <input name="smtpUsername" style="width:100%;padding:.55rem;margin-bottom:.75rem;" />
        <label style="display:block;margin-bottom:.4rem;">SMTP password (optional)</label>
        <input name="smtpPassword" type="password" style="width:100%;padding:.55rem;margin-bottom:.75rem;" autocomplete="off" />
        <div style="margin-top:.75rem;">
          <button type="submit">Save settings</button>
          <span id="contact-settings-status" style="margin-left:.6rem;color:#166534;"></span>
        </div>
        <div id="contact-notification-health" style="margin-top:.9rem;padding:.75rem;border:1px solid #dbe4ee;border-radius:10px;background:#f8fafc;color:#334155;">Loading notification health...</div>
      </form>
    </section>

    <section style="margin:1rem 0;padding:1rem;border:1px solid #dbe4ee;border-radius:12px;background:#fff;">
      <h2 style="margin-top:0;">Submissions</h2>
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.7rem;">
        <label for="contact-notification-filter" style="font-weight:600;color:#0f172a;">Notification</label>
        <select id="contact-notification-filter" style="padding:.35rem .5rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff;max-width:100%;">
          <option value="all">All</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
          <option value="not-attempted">Not attempted</option>
        </select>
        <span style="color:#64748b;font-size:.9rem;">Messages are always saved, even when notification fails or is skipped.</span>
      </div>
      <p id="contact-notification-summary" style="margin:.25rem 0 .7rem;color:#334155;font-size:.92rem;line-height:1.4;">Notification totals: loading…</p>
      <div id="contact-submissions-empty" style="display:none;">No submissions yet.</div>
      <table id="contact-submissions-table" style="width:100%;border-collapse:collapse;display:none;">
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Email</th>
            <th align="left">Subject</th>
            <th align="left">Status</th>
            <th align="left">Notification</th>
            <th align="left">Created</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>

    <section id="contact-submission-detail" style="margin:1rem 0;padding:1rem;border:1px solid #dbe4ee;border-radius:12px;background:#fff;display:none;"></section>
  </section>

  <script>
    const settingsForm = document.getElementById('contact-settings-form');
    const settingsStatus = document.getElementById('contact-settings-status');
    const notificationHealth = document.getElementById('contact-notification-health');
    const table = document.getElementById('contact-submissions-table');
    const emptyState = document.getElementById('contact-submissions-empty');
    const tbody = table.querySelector('tbody');
    const detail = document.getElementById('contact-submission-detail');
    const notificationFilter = document.getElementById('contact-notification-filter');
    const notificationSummary = document.getElementById('contact-notification-summary');

    const escapeHtml = (value) => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

    const loadSettings = async () => {
      const response = await fetch('/admin-api/contact-form/settings');
      const settings = await response.json();
      settingsForm.elements.formTitle.value = settings.formTitle ?? '';
      settingsForm.elements.submitButtonText.value = settings.submitButtonText ?? '';
      settingsForm.elements.successMessage.value = settings.successMessage ?? '';
      settingsForm.elements.notificationEnabled.checked = Boolean(settings.notification?.enabled);
      settingsForm.elements.recipientEmail.value = settings.notification?.recipientEmail ?? '';
      settingsForm.elements.fromName.value = settings.notification?.fromName ?? '';
      settingsForm.elements.fromEmail.value = settings.notification?.fromEmail ?? '';
      settingsForm.elements.smtpHost.value = settings.notification?.smtpHost ?? '';
      settingsForm.elements.smtpPort.value = settings.notification?.smtpPort ?? '';
      settingsForm.elements.smtpSecure.checked = Boolean(settings.notification?.smtpSecure);
      settingsForm.elements.smtpUsername.value = settings.notification?.smtpUsername ?? '';
      settingsForm.elements.smtpPassword.value = settings.notification?.smtpPassword ?? '';

      const hint = settings.notificationHealthHint || {};
      notificationHealth.textContent = hint.message || 'Notification health will appear after setup.';
      const tone = hint.tone || 'neutral';
      notificationHealth.style.borderColor = tone === 'positive' ? '#86efac' : tone === 'warning' ? '#fcd34d' : '#dbe4ee';
      notificationHealth.style.background = tone === 'positive' ? '#f0fdf4' : tone === 'warning' ? '#fffbeb' : '#f8fafc';
      notificationHealth.style.color = tone === 'positive' ? '#166534' : tone === 'warning' ? '#92400e' : '#334155';
    };

    const renderNotificationBadge = (record) => {
      const label = escapeHtml(record.notificationBadgeLabel || 'Not attempted');
      const tone = record.notificationBadgeTone || 'neutral';
      const border = tone === 'positive' ? '#86efac' : tone === 'warning' ? '#fcd34d' : '#dbe4ee';
      const background = tone === 'positive' ? '#f0fdf4' : tone === 'warning' ? '#fffbeb' : '#f8fafc';
      const color = tone === 'positive' ? '#166534' : tone === 'warning' ? '#92400e' : '#334155';
      return '<span style="display:inline-block;padding:.15rem .5rem;border:1px solid ' + border + ';border-radius:999px;background:' + background + ';color:' + color + ';font-size:.84rem;">' + label + '</span>';
    };

    const renderSubmissionRows = (records) => records.map((record) => {
      const id = escapeHtml(record.id);
      const name = escapeHtml(record.name);
      const email = escapeHtml(record.email);
      const subject = escapeHtml(record.subject || '-');
      const status = escapeHtml(record.status);
      const notificationBadge = renderNotificationBadge(record);
      const createdAt = escapeHtml(record.createdAt);
      return '<tr>'
        + '<td><button data-id="' + id + '" style="border:none;background:none;padding:0;color:#0f4c81;cursor:pointer;text-decoration:underline;">' + name + '</button></td>'
        + '<td>' + email + '</td>'
        + '<td>' + subject + '</td>'
        + '<td>' + status + '</td>'
        + '<td>' + notificationBadge + '</td>'
        + '<td>' + createdAt + '</td>'
        + '</tr>';
    }).join('');

    const renderNotificationSummary = (summary) => {
      if (!notificationSummary) {
        return;
      }

      const total = Number(summary?.total ?? 0);
      const failed = Number(summary?.failed ?? 0);
      const skipped = Number(summary?.skipped ?? 0);
      const sent = Number(summary?.sent ?? 0);
      notificationSummary.textContent = 'Notification totals (all saved submissions): '
        + 'Total: ' + total
        + ' · Failed: ' + failed
        + ' · Skipped: ' + skipped
        + ' · Sent: ' + sent;
    };

    const loadNotificationSummary = async () => {
      const response = await fetch('/admin-api/contact-form/submissions/summary');
      const summary = await response.json();
      renderNotificationSummary(summary);
    };

    const loadSubmissions = async () => {
      const selectedFilter = notificationFilter?.value || 'all';
      const query = selectedFilter === 'all'
        ? ''
        : '?notification=' + encodeURIComponent(selectedFilter);

      const response = await fetch('/admin-api/contact-form/submissions' + query);
      const records = await response.json();

      if (!Array.isArray(records) || records.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        tbody.innerHTML = '';
        detail.style.display = 'none';
        detail.innerHTML = '';
        return;
      }

      emptyState.style.display = 'none';
      table.style.display = 'table';
      tbody.innerHTML = renderSubmissionRows(records);

      for (const button of tbody.querySelectorAll('button[data-id]')) {
        button.addEventListener('click', () => openDetail(button.dataset.id));
      }
    };

    const openDetail = async (id) => {
      if (!id) {
        return;
      }

      const response = await fetch('/admin-api/contact-form/submissions/' + encodeURIComponent(id));
      if (response.status !== 200) {
        return;
      }

      const record = await response.json();
      detail.style.display = 'block';
      detail.innerHTML = '<h2 style="margin-top:0;">Message from ' + escapeHtml(record.name) + '</h2>'
        + '<p><strong>Email:</strong> ' + escapeHtml(record.email) + '</p>'
        + '<p><strong>Subject:</strong> ' + escapeHtml(record.subject || '-') + '</p>'
        + '<p><strong>Status:</strong> ' + escapeHtml(record.status) + '</p>'
        + '<p><strong>Notification:</strong> ' + renderNotificationBadge(record) + '</p>'
        + '<p style="margin-top:.35rem;color:#334155;">' + escapeHtml(record.notificationDetailText || 'Notification state is unavailable. The message is still saved.') + '</p>'
        + '<p><strong>Submitted:</strong> ' + escapeHtml(record.createdAt) + '</p>'
        + '<h3>Message</h3>'
        + '<pre style="white-space:pre-wrap;background:#f8fafc;padding:.75rem;border:1px solid #dbe4ee;border-radius:8px;">' + escapeHtml(record.message) + '</pre>'
        + '<button id="mark-read-button">Mark as read</button>';

      const markReadButton = document.getElementById('mark-read-button');
      markReadButton.addEventListener('click', async () => {
        await fetch('/admin-api/contact-form/submissions/' + encodeURIComponent(id) + '/read', { method: 'POST' });
        await loadSubmissions();
        await openDetail(id);
      });
    };

    settingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      settingsStatus.textContent = '';
      await fetch('/admin-api/contact-form/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          formTitle: settingsForm.elements.formTitle.value,
          submitButtonText: settingsForm.elements.submitButtonText.value,
          successMessage: settingsForm.elements.successMessage.value,
          notification: {
            enabled: settingsForm.elements.notificationEnabled.checked,
            recipientEmail: settingsForm.elements.recipientEmail.value,
            fromName: settingsForm.elements.fromName.value,
            fromEmail: settingsForm.elements.fromEmail.value,
            smtpHost: settingsForm.elements.smtpHost.value,
            smtpPort: settingsForm.elements.smtpPort.value,
            smtpSecure: settingsForm.elements.smtpSecure.checked,
            smtpUsername: settingsForm.elements.smtpUsername.value,
            smtpPassword: settingsForm.elements.smtpPassword.value
          }
        })
      });
      settingsStatus.textContent = 'Saved';
      await loadSettings();
    });

    notificationFilter?.addEventListener('change', () => {
      void loadSubmissions();
    });

    void loadSettings();
    void loadNotificationSummary();
    void loadSubmissions();
  </script>
`;


const toSubmissionSummary = (record) => {
  const notification = normalizeSubmissionNotificationState(record?.data);
  const notificationView = toNotificationStatusView(notification);

  return {
    id: `${record?.id ?? ''}`,
    name: `${record?.data?.name ?? ''}`,
    email: `${record?.data?.email ?? ''}`,
    subject: `${record?.data?.subject ?? ''}`,
    status: `${record?.data?.status ?? 'new'}`,
    createdAt: `${record?.data?.createdAt ?? record?.createdAt ?? ''}`,
    notificationStatus: notification.status,
    notificationAttemptedAt: notification.attemptedAt,
    notificationErrorSummary: notification.errorSummary,
    notificationSkipReason: notification.skipReason,
    notificationBadgeLabel: notificationView.badgeLabel,
    notificationBadgeTone: notificationView.tone,
    notificationDetailText: notificationView.detailText
  };
};

const toSubmissionDetail = (record) => ({
  ...toSubmissionSummary(record),
  message: `${record?.data?.message ?? ''}`
});

export default async function register(api) {
  const recentSubmissions = new Map<string, number>();

  const logNotificationFailure = (message: string, error?: unknown) => {
    const details = error instanceof Error ? error.message : `${error ?? ''}`;
    if (typeof api?.runtime?.logger?.warn === 'function') {
      api.runtime.logger.warn(`[contact-form] ${message}${details ? ` (${details})` : ''}`);
      return;
    }

    console.warn(`[contact-form] ${message}${details ? ` (${details})` : ''}`);
  };

  const persistNotificationHealth = (status: ContactNotificationHealthStatus, update?: Partial<ContactNotificationHealth>) => {
    const existing = loadSettings();
    const next: ContactSettings = {
      ...existing,
      notificationHealth: {
        ...existing.notificationHealth,
        ...update,
        lastNotificationStatus: status
      }
    };

    const row = api.runtime.db.list(CONTACT_SETTINGS_TYPE, { limit: 1 })[0];
    if (!row) {
      api.runtime.db.create(CONTACT_SETTINGS_TYPE, toStoredSettings(next));
      return;
    }

    api.runtime.db.update(CONTACT_SETTINGS_TYPE, `${row.id}`, toStoredSettings(next));
  };

  const sendNotificationEmail = async (settings: ContactNotificationSettings, submission: { name: string, email: string, subject: string, message: string, createdAt: string }): Promise<ContactSubmissionNotificationState> => {
    const attemptedAt = new Date().toISOString();
    if (!settings.enabled) {
      persistNotificationHealth('skipped', {
        lastNotificationAttemptAt: attemptedAt,
        lastNotificationSkipReason: 'email notifications are off',
        lastNotificationErrorSummary: ''
      });
      return {
        status: 'skipped',
        attemptedAt,
        errorSummary: '',
        skipReason: 'email notifications are off'
      };
    }

    if (!isValidNotificationSettings(settings)) {
      persistNotificationHealth('skipped', {
        lastNotificationAttemptAt: attemptedAt,
        lastNotificationSkipReason: 'notification settings are incomplete',
        lastNotificationErrorSummary: ''
      });
      return {
        status: 'skipped',
        attemptedAt,
        errorSummary: '',
        skipReason: 'notification settings are incomplete'
      };
    }

    try {
      await sendSmtpNotification({ settings, submission });
      persistNotificationHealth('success', {
        lastNotificationAttemptAt: attemptedAt,
        lastNotificationErrorSummary: '',
        lastNotificationSkipReason: ''
      });
      return {
        status: 'success',
        attemptedAt,
        errorSummary: '',
        skipReason: ''
      };
    } catch (error) {
      logNotificationFailure('Failed to send contact form notification email.', error);
      const errorSummary = summarizeNotificationError(error);
      persistNotificationHealth('failed', {
        lastNotificationAttemptAt: attemptedAt,
        lastNotificationErrorSummary: errorSummary,
        lastNotificationSkipReason: ''
      });
      return {
        status: 'failed',
        attemptedAt,
        errorSummary,
        skipReason: ''
      };
    }
  };

  const loadSettings = (): ContactSettings => {
    const rows = api.runtime.db.list(CONTACT_SETTINGS_TYPE, { limit: 1 });
    const entry = rows[0];

    if (!entry) {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      formTitle: normalizeText(entry?.data?.formTitle, DEFAULT_SETTINGS.formTitle),
      submitButtonText: normalizeText(entry?.data?.submitButtonText, DEFAULT_SETTINGS.submitButtonText),
      successMessage: normalizeText(entry?.data?.successMessage, DEFAULT_SETTINGS.successMessage),
      notification: normalizeNotificationSettingsFromRecord(entry?.data),
      notificationHealth: normalizeNotificationHealthFromRecord(entry?.data)
    };
  };

  const saveSettings = (data: Record<string, unknown>) => {
    const existing = api.runtime.db.list(CONTACT_SETTINGS_TYPE, { limit: 1 })[0];
    const normalized: ContactSettings = {
      formTitle: normalizeText(data.formTitle, DEFAULT_SETTINGS.formTitle),
      submitButtonText: normalizeText(data.submitButtonText, DEFAULT_SETTINGS.submitButtonText),
      successMessage: normalizeText(data.successMessage, DEFAULT_SETTINGS.successMessage),
      notification: normalizeNotificationSettings(data.notification),
      notificationHealth: existing
        ? normalizeNotificationHealthFromRecord(existing.data)
        : { ...DEFAULT_SETTINGS.notificationHealth }
    };

    if (!existing) {
      return api.runtime.db.create(CONTACT_SETTINGS_TYPE, toStoredSettings(normalized));
    }

    return api.runtime.db.update(CONTACT_SETTINGS_TYPE, `${existing.id}`, toStoredSettings(normalized));
  };

  api.runtime.contentTypes.register({
    name: 'Contact Submission',
    slug: CONTACT_SUBMISSION_TYPE,
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'subject', type: 'string' },
      { name: 'message', type: 'string', required: true },
      { name: 'status', type: 'string', required: true },
      { name: 'createdAt', type: 'string', required: true },
      { name: 'notificationStatus', type: 'string' },
      { name: 'notificationAttemptedAt', type: 'string' },
      { name: 'notificationErrorSummary', type: 'string' },
      { name: 'notificationSkipReason', type: 'string' }
    ]
  });

  api.runtime.contentTypes.register({
    name: 'Contact Form Settings',
    slug: CONTACT_SETTINGS_TYPE,
    fields: [
      { name: 'formTitle', type: 'string', required: true },
      { name: 'submitButtonText', type: 'string', required: true },
      { name: 'successMessage', type: 'string', required: true },
      { name: 'notificationEnabled', type: 'boolean' },
      { name: 'notificationRecipientEmail', type: 'string' },
      { name: 'notificationFromName', type: 'string' },
      { name: 'notificationFromEmail', type: 'string' },
      { name: 'smtpHost', type: 'string' },
      { name: 'smtpPort', type: 'number' },
      { name: 'smtpSecure', type: 'boolean' },
      { name: 'smtpUsername', type: 'string' },
      { name: 'smtpPassword', type: 'string' },
      { name: 'lastNotificationAttemptAt', type: 'string' },
      { name: 'lastNotificationStatus', type: 'string' },
      { name: 'lastNotificationErrorSummary', type: 'string' },
      { name: 'lastNotificationSkipReason', type: 'string' }
    ]
  });

  if (!api.runtime.db.list(CONTACT_SETTINGS_TYPE, { limit: 1 })[0]) {
    api.runtime.db.create(CONTACT_SETTINGS_TYPE, toStoredSettings({ ...DEFAULT_SETTINGS }));
  }

  api.runtime.admin.navRegistry.register({
    id: 'contact-form',
    label: 'Contact Form',
    path: '/admin/contact-form',
    order: 70
  });

  api.runtime.hooks.register('admin.menu', (menu) => {
    menu.register({
      id: 'contact-form',
      title: 'Contact Form',
      path: '/admin/contact-form',
      icon: 'mail'
    });
  });

  api.runtime.hooks.register('admin.page', (pages) => {
    pages.register({
      id: 'contact-form',
      path: '/admin/contact-form',
      title: 'Contact Form',
      render: () => renderAdminPage()
    });
  });

  api.runtime.http.register({
    method: 'GET',
    path: '/contact',
    handler: (context) => {
      const settings = loadSettings();
      const success = `${context?.query?.success ?? ''}`.trim() === '1';

      return toHtmlResponse(renderPublicForm({
        settings,
        values: { name: '', email: '', subject: '', message: '', website: '' },
        errors: [],
        successNotice: success ? settings.successMessage : undefined
      }));
    }
  });

  api.runtime.http.register({
    method: 'POST',
    path: '/contact',
    handler: async (context) => {
      const payload = await readUrlEncodedBody(context.request);
      const values: ContactFormValues = {
        name: trimText(payload.name),
        email: trimText(payload.email).toLowerCase(),
        subject: trimText(payload.subject),
        message: trimText(payload.message),
        website: trimText(payload.website)
      };

      const settings = loadSettings();
      const errors: string[] = [];

      if (!values.name) {
        errors.push('Name is required.');
      }

      if (!values.email) {
        errors.push('Email is required.');
      } else if (!EMAIL_PATTERN.test(values.email)) {
        errors.push('Email format is invalid.');
      }

      if (!values.message) {
        errors.push('Message is required.');
      }

      if (values.website) {
        return toRedirect('/contact?success=1');
      }

      const clientAddress = getClientAddress(context.request);
      const now = Date.now();
      const previous = recentSubmissions.get(clientAddress) ?? 0;
      if (now - previous < SPAM_COOLDOWN_MS) {
        errors.push('Please wait a few seconds before sending another message.');
      }

      if (errors.length > 0) {
        return toHtmlResponse(renderPublicForm({
          settings,
          values,
          errors
        }), 400);
      }

      recentSubmissions.set(clientAddress, now);

      const createdAt = new Date().toISOString();
      const created = api.runtime.db.create(CONTACT_SUBMISSION_TYPE, {
        name: values.name,
        email: values.email,
        subject: values.subject,
        message: values.message,
        status: 'new',
        createdAt,
        notificationStatus: 'unknown',
        notificationAttemptedAt: '',
        notificationErrorSummary: '',
        notificationSkipReason: ''
      });

      const notificationState = await sendNotificationEmail(settings.notification, {
        name: values.name,
        email: values.email,
        subject: values.subject,
        message: values.message,
        createdAt
      });

      api.runtime.db.update(CONTACT_SUBMISSION_TYPE, `${created.id}`, {
        ...created.data,
        notificationStatus: notificationState.status,
        notificationAttemptedAt: notificationState.attemptedAt,
        notificationErrorSummary: notificationState.errorSummary,
        notificationSkipReason: notificationState.skipReason
      });

      return toRedirect('/contact?success=1');
    }
  });

  api.runtime.http.register({
    method: 'GET',
    path: '/admin-api/contact-form/settings',
    handler: () => {
      const settings = loadSettings();
      return toJsonResponse({
        ...settings,
        notificationHealthHint: buildNotificationHealthHint(settings)
      });
    }
  });

  api.runtime.http.register({
    method: 'PUT',
    path: '/admin-api/contact-form/settings',
    handler: async (context) => {
      const payload = await readJsonBody(context.request);
      saveSettings(payload);
      return toJsonResponse(loadSettings());
    }
  });

  api.runtime.http.register({
    method: 'GET',
    path: '/admin-api/contact-form/submissions',
    handler: (context) => {
      const notificationFilter = normalizeNotificationFilter(context?.query?.notification);
      const rows = api.runtime.db.list(CONTACT_SUBMISSION_TYPE, { sort: 'createdAt desc', limit: 200 });
      const summaries = rows.map(toSubmissionSummary);
      const filtered = summaries.filter((summary) => matchesNotificationFilter(summary.notificationStatus, notificationFilter));
      return toJsonResponse(filtered);
    }
  });

  api.runtime.http.register({
    method: 'GET',
    path: '/admin-api/contact-form/submissions/summary',
    handler: () => {
      const rows = api.runtime.db.list(CONTACT_SUBMISSION_TYPE, { sort: 'createdAt desc', limit: 200 });
      const summaries = rows.map(toSubmissionSummary);
      const counts = countSubmissionNotifications(summaries);
      return toJsonResponse(counts);
    }
  });

  api.runtime.http.register({
    method: 'GET',
    path: '/admin-api/contact-form/submissions/:id',
    handler: (context) => {
      const id = `${context?.params?.id ?? ''}`;
      const record = api.runtime.db.get(CONTACT_SUBMISSION_TYPE, id);

      if (!record) {
        return toJsonResponse({ error: { code: 'CONTACT_SUBMISSION_NOT_FOUND', message: 'Submission not found.' } }, 404);
      }

      return toJsonResponse(toSubmissionDetail(record));
    }
  });

  api.runtime.http.register({
    method: 'POST',
    path: '/admin-api/contact-form/submissions/:id/read',
    handler: (context) => {
      const id = `${context?.params?.id ?? ''}`;
      const record = api.runtime.db.get(CONTACT_SUBMISSION_TYPE, id);

      if (!record) {
        return toJsonResponse({ error: { code: 'CONTACT_SUBMISSION_NOT_FOUND', message: 'Submission not found.' } }, 404);
      }

      api.runtime.db.update(CONTACT_SUBMISSION_TYPE, id, {
        ...record.data,
        status: 'read'
      });

      return toJsonResponse({ ok: true });
    }
  });
}
