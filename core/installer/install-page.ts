const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

type InstallPageInput = {
  error?: string
  notice?: string
  values?: {
    siteTitle?: string
    adminUser?: string
  }
};

export const renderInstallPage = ({ error = '', notice = '', values = {} }: InstallPageInput = {}) => {
  const siteTitle = escapeHtml(`${values.siteTitle ?? ''}`);
  const adminUser = escapeHtml(`${values.adminUser ?? ''}`);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Install Nimb CMS</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        background: #f5f7fb;
        color: #1f2937;
      }
      main {
        max-width: 680px;
        margin: 48px auto;
        padding: 0 18px;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        box-shadow: 0 6px 22px rgba(17, 24, 39, 0.05);
        padding: 28px;
      }
      h1 { margin: 0 0 10px; font-size: 1.8rem; }
      h2 { margin: 20px 0 8px; font-size: 1rem; }
      p { margin: 0 0 12px; line-height: 1.55; }
      .help { color: #4b5563; font-size: 0.95rem; }
      .alert {
        margin-bottom: 14px;
        border-radius: 10px;
        padding: 10px 12px;
        border: 1px solid;
      }
      .alert.error {
        color: #7f1d1d;
        background: #fef2f2;
        border-color: #fecaca;
      }
      .alert.notice {
        color: #1e3a8a;
        background: #eff6ff;
        border-color: #bfdbfe;
      }
      form { margin-top: 14px; }
      .field { margin-bottom: 14px; }
      label { font-weight: 600; display: block; margin-bottom: 6px; }
      input {
        box-sizing: border-box;
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 11px 12px;
        font-size: 1rem;
      }
      small { display: block; color: #6b7280; margin-top: 6px; }
      button {
        width: 100%;
        border: none;
        border-radius: 9px;
        background: #111827;
        color: #fff;
        font-size: 1rem;
        padding: 11px 14px;
        cursor: pointer;
      }
      .next-step {
        margin-top: 12px;
        color: #4b5563;
        font-size: 0.95rem;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>Set up your Nimb website</h1>
        <p class="help">This takes about one minute. You will create your website name and your first admin account.</p>
        ${notice ? `<p class="alert notice" role="status">${escapeHtml(notice)}</p>` : ''}
        ${error ? `<p class="alert error" role="alert">${escapeHtml(error)}</p>` : ''}
        <form method="post" action="/install">
          <h2>Website details</h2>
          <div class="field">
            <label for="siteTitle">Website name *</label>
            <input id="siteTitle" type="text" name="siteTitle" value="${siteTitle}" minlength="2" maxlength="120" autocomplete="organization" required />
            <small>This will be shown in your website header and browser title.</small>
          </div>

          <h2>Admin account</h2>
          <div class="field">
            <label for="adminUser">Admin username *</label>
            <input id="adminUser" type="text" name="adminUser" value="${adminUser}" minlength="3" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" autocomplete="username" required />
            <small>Use 3-32 characters. Letters, numbers, dots, dashes, and underscores are allowed.</small>
          </div>
          <div class="field">
            <label for="adminPassword">Admin password *</label>
            <input id="adminPassword" type="password" name="adminPassword" minlength="8" autocomplete="new-password" required />
            <small>Use at least 8 characters with at least one letter and one number.</small>
          </div>
          <div class="field">
            <label for="adminPasswordConfirm">Confirm admin password *</label>
            <input id="adminPasswordConfirm" type="password" name="adminPasswordConfirm" minlength="8" autocomplete="new-password" required />
            <small>Re-enter your admin password to avoid typing mistakes.</small>
          </div>
          <button type="submit">Finish setup and continue to login</button>
          <p class="next-step">After setup, you will be redirected to the admin login page.</p>
        </form>
      </section>
    </main>
  </body>
</html>
`;
};
