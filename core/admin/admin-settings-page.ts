const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const renderAdminSettingsPage = (settings = {}) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Settings · Nimb Admin</title>
</head>
<body>
  <main>
    <h1>Site Settings</h1>
    <form id="settings-form">
      <label>Site name <input id="siteName" name="siteName" value="${escapeHtml(settings.siteName ?? '')}" /></label><br/>
      <label>Tagline <input id="tagline" name="tagline" value="${escapeHtml(settings.tagline ?? '')}" /></label><br/>
      <label>Timezone <input id="timezone" name="timezone" value="${escapeHtml(settings.timezone ?? '')}" /></label><br/>
      <label>Active theme <input id="theme" name="theme" value="${escapeHtml(settings.theme ?? '')}" /></label><br/>
      <button type="submit">Save</button>
      <p id="status" aria-live="polite"></p>
    </form>
  </main>
  <script>
    const form = document.getElementById('settings-form');
    const status = document.getElementById('status');
    const fields = ['siteName', 'tagline', 'timezone', 'theme'];

    const setStatus = (text) => {
      if (status) {
        status.textContent = text;
      }
    };

    const load = () => fetch('/admin-api/settings')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('failed')))
      .then((settings) => {
        fields.forEach((key) => {
          const input = document.getElementById(key);
          if (input) {
            input.value = settings?.[key] ?? '';
          }
        });
      })
      .catch(() => {
        setStatus('Failed to load settings.');
      });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(fields.map((key) => [key, document.getElementById(key)?.value ?? '']));
      setStatus('Saving...');

      void fetch('/admin-api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('failed')))
        .then(() => {
          setStatus('Settings saved.');
        })
        .catch(() => {
          setStatus('Failed to save settings.');
        });
    });

    void load();
  </script>
</body>
</html>`;
