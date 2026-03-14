const CONTACT_SUBMISSION_TYPE = 'contact-submission';
const CONTACT_SETTINGS_TYPE = 'contact-form-settings';
const SPAM_COOLDOWN_MS = 10_000;

type ContactSettings = {
  formTitle: string;
  submitButtonText: string;
  successMessage: string;
};

type ContactFormValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

const DEFAULT_SETTINGS: ContactSettings = Object.freeze({
  formTitle: 'Contact Us',
  submitButtonText: 'Send Message',
  successMessage: 'Thanks for your message. We will review it soon.'
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        <div style="margin-top:.75rem;">
          <button type="submit">Save settings</button>
          <span id="contact-settings-status" style="margin-left:.6rem;color:#166534;"></span>
        </div>
      </form>
    </section>

    <section style="margin:1rem 0;padding:1rem;border:1px solid #dbe4ee;border-radius:12px;background:#fff;">
      <h2 style="margin-top:0;">Submissions</h2>
      <div id="contact-submissions-empty" style="display:none;">No submissions yet.</div>
      <table id="contact-submissions-table" style="width:100%;border-collapse:collapse;display:none;">
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Email</th>
            <th align="left">Subject</th>
            <th align="left">Status</th>
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
    const table = document.getElementById('contact-submissions-table');
    const emptyState = document.getElementById('contact-submissions-empty');
    const tbody = table.querySelector('tbody');
    const detail = document.getElementById('contact-submission-detail');

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
    };

    const renderSubmissionRows = (records) => records.map((record) => {
      const id = escapeHtml(record.id);
      const name = escapeHtml(record.name);
      const email = escapeHtml(record.email);
      const subject = escapeHtml(record.subject || '-');
      const status = escapeHtml(record.status);
      const createdAt = escapeHtml(record.createdAt);
      return '<tr>'
        + '<td><button data-id="' + id + '" style="border:none;background:none;padding:0;color:#0f4c81;cursor:pointer;text-decoration:underline;">' + name + '</button></td>'
        + '<td>' + email + '</td>'
        + '<td>' + subject + '</td>'
        + '<td>' + status + '</td>'
        + '<td>' + createdAt + '</td>'
        + '</tr>';
    }).join('');

    const loadSubmissions = async () => {
      const response = await fetch('/admin-api/contact-form/submissions');
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
          successMessage: settingsForm.elements.successMessage.value
        })
      });
      settingsStatus.textContent = 'Saved';
    });

    void loadSettings();
    void loadSubmissions();
  </script>
`;


const toSubmissionSummary = (record) => ({
  id: `${record?.id ?? ''}`,
  name: `${record?.data?.name ?? ''}`,
  email: `${record?.data?.email ?? ''}`,
  subject: `${record?.data?.subject ?? ''}`,
  status: `${record?.data?.status ?? 'new'}`,
  createdAt: `${record?.data?.createdAt ?? record?.createdAt ?? ''}`
});

const toSubmissionDetail = (record) => ({
  ...toSubmissionSummary(record),
  message: `${record?.data?.message ?? ''}`
});

export default async function register(api) {
  const recentSubmissions = new Map<string, number>();

  const loadSettings = (): ContactSettings => {
    const rows = api.runtime.db.list(CONTACT_SETTINGS_TYPE, { limit: 1 });
    const entry = rows[0];

    if (!entry) {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      formTitle: normalizeText(entry?.data?.formTitle, DEFAULT_SETTINGS.formTitle),
      submitButtonText: normalizeText(entry?.data?.submitButtonText, DEFAULT_SETTINGS.submitButtonText),
      successMessage: normalizeText(entry?.data?.successMessage, DEFAULT_SETTINGS.successMessage)
    };
  };

  const saveSettings = (data: Record<string, unknown>) => {
    const existing = api.runtime.db.list(CONTACT_SETTINGS_TYPE, { limit: 1 })[0];
    const normalized = {
      formTitle: normalizeText(data.formTitle, DEFAULT_SETTINGS.formTitle),
      submitButtonText: normalizeText(data.submitButtonText, DEFAULT_SETTINGS.submitButtonText),
      successMessage: normalizeText(data.successMessage, DEFAULT_SETTINGS.successMessage)
    };

    if (!existing) {
      return api.runtime.db.create(CONTACT_SETTINGS_TYPE, normalized);
    }

    return api.runtime.db.update(CONTACT_SETTINGS_TYPE, `${existing.id}`, normalized);
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
      { name: 'createdAt', type: 'string', required: true }
    ]
  });

  api.runtime.contentTypes.register({
    name: 'Contact Form Settings',
    slug: CONTACT_SETTINGS_TYPE,
    fields: [
      { name: 'formTitle', type: 'string', required: true },
      { name: 'submitButtonText', type: 'string', required: true },
      { name: 'successMessage', type: 'string', required: true }
    ]
  });

  if (!api.runtime.db.list(CONTACT_SETTINGS_TYPE, { limit: 1 })[0]) {
    api.runtime.db.create(CONTACT_SETTINGS_TYPE, { ...DEFAULT_SETTINGS });
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

      api.runtime.db.create(CONTACT_SUBMISSION_TYPE, {
        name: values.name,
        email: values.email,
        subject: values.subject,
        message: values.message,
        status: 'new',
        createdAt: new Date().toISOString()
      });

      return toRedirect('/contact?success=1');
    }
  });

  api.runtime.http.register({
    method: 'GET',
    path: '/admin-api/contact-form/settings',
    handler: () => toJsonResponse(loadSettings())
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
    handler: () => {
      const rows = api.runtime.db.list(CONTACT_SUBMISSION_TYPE, { sort: 'createdAt desc', limit: 200 });
      return toJsonResponse(rows.map(toSubmissionSummary));
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
