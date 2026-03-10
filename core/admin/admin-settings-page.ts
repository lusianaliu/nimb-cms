import { renderAdminShell, escapeHtml } from './admin-shell.ts';

export const renderAdminSettingsPage = (settings = {}, runtime) => renderAdminShell({
  title: 'Settings · Nimb Admin',
  runtime,
  activeNav: 'settings',
  pageTitle: 'Settings',
  pageDescription: 'Control core site information and basic preferences.',
  content: `<form id="settings-form">
      <div>
        <label for="siteName">Site name</label>
        <input id="siteName" name="siteName" value="${escapeHtml(settings.siteName ?? '')}" />
      </div>
      <div>
        <label for="tagline">Tagline</label>
        <input id="tagline" name="tagline" value="${escapeHtml(settings.tagline ?? '')}" />
      </div>
      <div>
        <label for="timezone">Timezone</label>
        <input id="timezone" name="timezone" value="${escapeHtml(settings.timezone ?? '')}" />
      </div>
      <div>
        <label for="theme">Active theme</label>
        <input id="theme" name="theme" value="${escapeHtml(settings.theme ?? '')}" />
      </div>
      <button type="submit">Save settings</button>
      <p id="status" aria-live="polite" class="muted"></p>
    </form>
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
    </script>`
});
