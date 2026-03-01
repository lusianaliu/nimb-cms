const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const renderLoginView = ({ title = 'Admin Login', email = '', error = '' }: { title?: string, email?: string, error?: string }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <main>
      <h1>Admin Login</h1>
      ${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}
      <form method="post" action="/admin/login">
        <label>
          Email
          <input type="email" name="email" value="${escapeHtml(email)}" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  </body>
</html>`;
