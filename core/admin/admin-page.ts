const escapeHtml = (value) => `${value}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const renderAdminPage = ({ adminBasePath = '/admin', username = 'admin' } = {}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nimb Admin</title>
  </head>
  <body>
    <header>
      <h1>Nimb Admin</h1>
      <p>Dashboard</p>
    </header>
    <main>
      <section aria-labelledby="dashboard-welcome">
        <h2 id="dashboard-welcome">Welcome</h2>
        <p>Signed in as <strong>${escapeHtml(username)}</strong>.</p>
      </section>

      <section aria-labelledby="dashboard-core-actions">
        <h2 id="dashboard-core-actions">Core actions</h2>
        <ul>
          <li><a href="/api/admin/status">View system status (JSON)</a></li>
          <li><a href="/api/admin/content-types">Content model API</a></li>
          <li><a href="/api/admin/entries/article">Entries API</a></li>
        </ul>
      </section>
      <section aria-labelledby="dashboard-route">
        <h2 id="dashboard-route">Admin route</h2>
        <p><code>${escapeHtml(adminBasePath)}</code></p>
      </section>
    </main>
  </body>
</html>`;
