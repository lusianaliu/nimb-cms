const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

type LoginViewInput = {
  title?: string
  email?: string
  error?: string
  notice?: string
  next?: string
};

export const renderLoginView = ({ title = 'Admin Login', email = '', error = '', notice = '', next = '' }: LoginViewInput) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .card { width: min(420px, 92vw); background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; }
      h1 { margin-top: 0; margin-bottom: 8px; }
      p { margin-top: 0; color: #475569; }
      label { display: block; font-weight: 600; margin: 12px 0 4px; }
      input { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font: inherit; }
      button { margin-top: 14px; width: 100%; border: 0; border-radius: 8px; background: #0f172a; color: #fff; padding: 10px; font: inherit; cursor: pointer; }
      .notice { margin: 10px 0; padding: 9px 10px; border-radius: 8px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1e3a8a; }
      .error { margin: 10px 0; padding: 9px 10px; border-radius: 8px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Admin login</h1>
      <p>Sign in to manage your site content and settings.</p>
      ${notice ? `<p class="notice" role="status">${escapeHtml(notice)}</p>` : ''}
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
      <form method="post" action="/admin/login">
        <input type="hidden" name="next" value="${escapeHtml(next)}" />
        <label for="email">Email</label>
        <input id="email" type="email" name="email" value="${escapeHtml(email)}" autocomplete="username" required />
        <label for="password">Password</label>
        <input id="password" type="password" name="password" autocomplete="current-password" required />
        <button type="submit">Sign in</button>
      </form>
    </main>
  </body>
</html>`;
