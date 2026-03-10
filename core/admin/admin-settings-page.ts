import { renderAdminShell, escapeHtml } from './admin-shell.ts';

export const renderAdminSettingsPage = (settings = {}, runtime) => renderAdminShell({
  title: 'Site Settings · Nimb Admin',
  runtime,
  activeNav: 'settings',
  pageTitle: 'Site Settings',
  pageDescription: 'Update your website name, homepage intro, and other public identity text.',
  content: `<form id="settings-form" class="form-grid" novalidate>
      <section>
        <h2>Site identity</h2>
        <p class="field-help">These details appear in your public site header and browser title.</p>
        <div>
          <label for="siteName">Website name</label>
          <input id="siteName" name="siteName" value="${escapeHtml(settings.siteName ?? '')}" />
          <p class="field-help">Shown in the top header and browser tab title.</p>
        </div>
        <div>
          <label for="tagline">Tagline</label>
          <input id="tagline" name="tagline" value="${escapeHtml(settings.tagline ?? '')}" />
          <p class="field-help">Short line shown below your website name on the homepage.</p>
        </div>
      </section>

      <section>
        <h2>Homepage</h2>
        <p class="field-help">This text introduces your website to first-time visitors.</p>
        <div>
          <label for="homepageIntro">Homepage introduction</label>
          <textarea id="homepageIntro" name="homepageIntro" rows="4">${escapeHtml(settings.homepageIntro ?? '')}</textarea>
          <p class="field-help">Shown in the welcome section on your homepage.</p>
        </div>
      </section>

      <section>
        <h2>Footer</h2>
        <div>
          <label for="footerText">Footer text</label>
          <input id="footerText" name="footerText" value="${escapeHtml(settings.footerText ?? '')}" />
          <p class="field-help">Optional text shown in the footer of every public page. Leave blank to use the default copyright line.</p>
        </div>
      </section>

      <section>
        <h2>Basic preferences</h2>
        <div>
          <label for="timezone">Timezone</label>
          <input id="timezone" name="timezone" value="${escapeHtml(settings.timezone ?? '')}" />
          <p class="field-help">Used for date/time display in future features. Keep this set to your local timezone.</p>
        </div>
        <div>
          <label for="theme">Theme</label>
          <input id="theme" name="theme" value="${escapeHtml(settings.theme ?? '')}" />
          <p class="field-help">Current active public theme identifier.</p>
        </div>
      </section>

      <div>
        <button type="submit">Save site settings</button>
      </div>
      <p id="status" aria-live="polite" class="muted"></p>
    </form>
    <script>
      const form = document.getElementById('settings-form');
      const status = document.getElementById('status');
      const fields = ['siteName', 'tagline', 'homepageIntro', 'footerText', 'timezone', 'theme'];

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
          setStatus('Loaded current settings.');
        })
        .catch(() => {
          setStatus('Could not load settings. Refresh and try again.');
        });

      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(fields.map((key) => [key, document.getElementById(key)?.value ?? '']));
        setStatus('Saving site settings...');

        void fetch('/admin-api/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error('failed')))
          .then(() => {
            setStatus('Site settings saved. View your homepage to confirm changes.');
          })
          .catch(() => {
            setStatus('Could not save settings. Please try again.');
          });
      });

      void load();
    </script>`
});
