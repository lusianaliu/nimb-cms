import { renderAdminShell, escapeHtml } from './admin-shell.ts';

export const renderAdminSettingsPage = (settings = {}, runtime) => renderAdminShell({
  title: 'Site Settings · Nimb Admin',
  runtime,
  activeNav: 'settings',
  pageTitle: 'Site Settings',
  pageDescription: 'Update your website identity text and basic public settings.',
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
      </section>

      <section>
        <h2>Public theme</h2>
        <p class="field-help">Choose how your public website looks. Theme changes are saved separately from other settings.</p>
        <div>
          <label for="activeThemeId">Active public theme</label>
          <select id="activeThemeId" name="activeThemeId">
            <option value="">Loading themes…</option>
          </select>
          <p class="field-help" id="theme-selection-help">Choose a theme and save to update your public website.</p>
          <p class="field-help" id="theme-coverage-hint" aria-live="polite"></p>
        </div>
        <p id="theme-state" class="field-help" aria-live="polite"></p>
        <p id="theme-selection-warning" class="field-help" aria-live="polite"></p>
        <details id="theme-diagnostics" class="field-help">
          <summary id="theme-diagnostics-summary">Theme diagnostics: loading…</summary>
          <ul id="theme-diagnostics-list"></ul>
        </details>
        <div>
          <button type="button" id="save-theme-button">Save theme</button>
        </div>
        <p id="theme-status" aria-live="polite" class="muted"></p>
      </section>

      <div>
        <button type="submit">Save site settings</button>
      </div>
      <p id="status" aria-live="polite" class="muted"></p>
    </form>
    <script>
      const form = document.getElementById('settings-form');
      const status = document.getElementById('status');
      const themeStatus = document.getElementById('theme-status');
      const themeState = document.getElementById('theme-state');
      const themeSelectionWarning = document.getElementById('theme-selection-warning');
      const themeCoverageHint = document.getElementById('theme-coverage-hint');
      const themeDiagnosticsSummary = document.getElementById('theme-diagnostics-summary');
      const themeDiagnosticsList = document.getElementById('theme-diagnostics-list');
      const themeSelect = document.getElementById('activeThemeId');
      const saveThemeButton = document.getElementById('save-theme-button');
      const fields = ['siteName', 'tagline', 'homepageIntro', 'footerText', 'timezone'];
      const canonicalTemplateCount = 5;
      let currentThemeData = null;

      const setStatus = (text) => {
        if (status) {
          status.textContent = text;
        }
      };

      const setThemeStatus = (text) => {
        if (themeStatus) {
          themeStatus.textContent = text;
        }
      };

      const setThemeState = (text) => {
        if (themeState) {
          themeState.textContent = text;
        }
      };

      const setThemeSelectionWarning = (text) => {
        if (themeSelectionWarning) {
          themeSelectionWarning.textContent = text;
        }
      };

      const setThemeCoverageHint = (text) => {
        if (themeCoverageHint) {
          themeCoverageHint.textContent = text;
        }
      };

      const setThemeDiagnosticsSummary = (text) => {
        if (themeDiagnosticsSummary) {
          themeDiagnosticsSummary.textContent = text;
        }
      };

      const setThemeDiagnosticsRows = (rows) => {
        if (!themeDiagnosticsList) {
          return;
        }

        themeDiagnosticsList.innerHTML = '';
        rows.forEach((row) => {
          const item = document.createElement('li');
          item.textContent = row;
          themeDiagnosticsList.appendChild(item);
        });
      };

      const describeTheme = (theme, fallbackId) => {
        const title = typeof theme?.title === 'string' && theme.title.trim() ? theme.title.trim() : (theme?.id ?? 'Unnamed theme');
        const suffix = theme?.id ? ' (' + theme.id + ')' : '';
        const fallbackTag = fallbackId && theme?.id === fallbackId ? ' — default fallback' : '';
        return title + suffix + fallbackTag;
      };

      const describeThemeCoverageTag = (theme, defaultThemeId) => {
        if (!theme || typeof theme.id !== 'string') {
          return 'Coverage details unavailable';
        }

        if (theme.id === defaultThemeId) {
          return 'Default fallback';
        }

        if (theme.supportsAllCanonicalTemplates === true) {
          return 'Complete';
        }

        if (theme.supportsAllCanonicalTemplates === false) {
          return 'Incomplete';
        }

        return 'Coverage details unavailable';
      };

      const buildThemeCoverageHint = (themeData, selectedThemeId) => {
        const defaultThemeId = themeData?.defaultThemeId ?? 'default';
        const fallbackApplied = themeData?.fallbackApplied === true;
        const configuredThemeId = themeData?.configuredThemeId ?? '';
        const resolvedThemeId = themeData?.resolvedThemeId ?? '';
        const themes = Array.isArray(themeData?.themes) ? themeData.themes : [];
        const selectedTheme = themes.find((theme) => theme?.id === selectedThemeId);

        if (!selectedTheme) {
          return 'Coverage hint: Choose a listed theme to see what is covered.';
        }

        if (selectedTheme.id === defaultThemeId) {
          return 'Coverage hint: This is the default theme and covers all core pages.';
        }

        if (selectedTheme.supportsAllCanonicalTemplates === true) {
          return 'Coverage hint: This theme covers all core pages.';
        }

        const missingCount = Array.isArray(selectedTheme.missingTemplates) ? selectedTheme.missingTemplates.length : 0;

        if (missingCount > 0) {
          return 'Coverage hint: ' + missingCount + ' core page template' + (missingCount === 1 ? '' : 's') + ' may use the default theme.';
        }

        if (selectedTheme.supportsAllCanonicalTemplates === false) {
          return 'Coverage hint: Some core pages may use the default theme.';
        }

        if (fallbackApplied && selectedTheme.id === configuredThemeId && configuredThemeId !== resolvedThemeId) {
          return 'Coverage hint: Nimb is currently using the default theme.';
        }

        return 'Coverage hint: Coverage details are not available right now.';
      };

      const buildThemeSelectionWarning = (themeData, selectedThemeId) => {
        const defaultThemeId = themeData?.defaultThemeId ?? 'default';
        const fallbackApplied = themeData?.fallbackApplied === true;
        const configuredThemeId = themeData?.configuredThemeId ?? '';
        const resolvedThemeId = themeData?.resolvedThemeId ?? '';
        const themes = Array.isArray(themeData?.themes) ? themeData.themes : [];
        const selectedTheme = themes.find((theme) => theme.id === selectedThemeId);

        if (!selectedTheme) {
          return 'Choose a listed theme to review what will happen before you save.';
        }

        if (selectedTheme.id === configuredThemeId && selectedTheme.id === resolvedThemeId && !fallbackApplied) {
          if (selectedTheme.supportsAllCanonicalTemplates === false) {
            const missingCount = Array.isArray(selectedTheme.missingTemplates) ? selectedTheme.missingTemplates.length : 0;
              return 'Already active. This theme is missing ' + missingCount + ' core page template' + (missingCount === 1 ? '' : 's') + ', so Nimb may use the default theme on some pages.';
          }

            return 'Already active. No changes needed unless you want a different look.';
        }

        if (selectedTheme.supportsAllCanonicalTemplates === false) {
          const missingTemplates = Array.isArray(selectedTheme.missingTemplates) ? selectedTheme.missingTemplates : [];
          if (missingTemplates.length > 0) {
            return 'You can save this theme, but it is missing ' + missingTemplates.length + ' of ' + canonicalTemplateCount + ' core templates (' + missingTemplates.join(', ') + '). Nimb will use the default theme for those pages.';
          }

          return 'You can save this theme, but Nimb may use the default theme on some pages.';
        }

        if (selectedTheme.id === defaultThemeId) {
          return 'This is the default theme. It is complete and safe for all pages.';
        }

        return 'Ready to save. This theme covers all core pages.';
      };

      const applyThemeDiagnostics = (themeData, selectedThemeId) => {
        const configuredThemeId = themeData?.configuredThemeId ?? '';
        const resolvedThemeId = themeData?.resolvedThemeId ?? '';
        const defaultThemeId = themeData?.defaultThemeId ?? 'default';
        const fallbackApplied = themeData?.fallbackApplied === true;
        const themes = Array.isArray(themeData?.themes) ? themeData.themes : [];
        const selectedTheme = themes.find((theme) => theme?.id === selectedThemeId);
        const configuredTheme = themes.find((theme) => theme?.id === configuredThemeId);
        const resolvedTheme = themes.find((theme) => theme?.id === resolvedThemeId);
        const diagnostics = [];

        diagnostics.push('Selected in settings: ' + describeTheme(configuredTheme, defaultThemeId) + '.');
        diagnostics.push('Resolved by runtime: ' + describeTheme(resolvedTheme, defaultThemeId) + '.');

        if (fallbackApplied) {
          diagnostics.push('The saved theme could not be used fully right now, so Nimb is using the default theme.');
        } else {
          diagnostics.push('The saved theme is being used normally.');
        }

        if (!selectedTheme) {
          diagnostics.push('Choose a listed theme to view coverage details.');
          setThemeDiagnosticsSummary('Theme diagnostics: choose a theme to view details');
          setThemeDiagnosticsRows(diagnostics);
          return;
        }

        if (selectedTheme.supportsAllCanonicalTemplates === false) {
          const missingTemplates = Array.isArray(selectedTheme.missingTemplates) ? selectedTheme.missingTemplates : [];
          if (missingTemplates.length > 0) {
            diagnostics.push('Coverage for selected theme: missing core templates — ' + missingTemplates.join(', ') + '.');
            diagnostics.push('Nimb will use default theme templates for those pages.');
            setThemeDiagnosticsSummary('Theme diagnostics: selected theme is partial (default theme may be used per page)');
          } else {
            diagnostics.push('Coverage for selected theme: detailed coverage is not available right now.');
            diagnostics.push('Nimb may still use the default theme for some pages.');
            setThemeDiagnosticsSummary('Theme diagnostics: selected theme is partial');
          }
        } else {
          diagnostics.push('Coverage for selected theme: all core templates are available.');
          diagnostics.push('Nimb is not expected to use default theme templates for core pages.');
          setThemeDiagnosticsSummary('Theme diagnostics: selected theme is complete');
        }

        setThemeDiagnosticsRows(diagnostics);
      };

      const renderThemeOptions = (themes, configuredThemeId, defaultThemeId) => {
        if (!themeSelect) {
          return;
        }

        const previousValue = themeSelect.value;
        themeSelect.innerHTML = '';
        if (!Array.isArray(themes) || themes.length === 0) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No themes available';
          themeSelect.appendChild(option);
          themeSelect.disabled = true;
          return;
        }

        themeSelect.disabled = false;
        themes.forEach((theme) => {
          if (!theme || typeof theme.id !== 'string') {
            return;
          }

          const option = document.createElement('option');
          option.value = theme.id;
          option.textContent = describeTheme(theme, defaultThemeId) + ' — ' + describeThemeCoverageTag(theme, defaultThemeId);
          option.selected = theme.id === configuredThemeId;
          themeSelect.appendChild(option);
        });

        const hasPreviousValue = previousValue && themes.some((theme) => theme?.id === previousValue);
        if (hasPreviousValue) {
          themeSelect.value = previousValue;
        }
      };

      const applyThemeStatus = (themeData) => {
        currentThemeData = themeData ?? null;
        const configuredThemeId = themeData?.configuredThemeId ?? '';
        const resolvedThemeId = themeData?.resolvedThemeId ?? '';
        const defaultThemeId = themeData?.defaultThemeId ?? 'default';
        const fallbackApplied = themeData?.fallbackApplied === true;
        const themes = Array.isArray(themeData?.themes) ? themeData.themes : [];
        const configuredTheme = themes.find((theme) => theme.id === configuredThemeId);
        const resolvedTheme = themes.find((theme) => theme.id === resolvedThemeId);

        renderThemeOptions(themes, configuredThemeId, defaultThemeId);

        if (fallbackApplied) {
          setThemeState('Saved theme: ' + (configuredThemeId || 'Not set') + '. Active theme: ' + describeTheme(resolvedTheme, defaultThemeId) + '. Nimb is currently using the default theme.');
        } else {
          setThemeState('Saved theme: ' + describeTheme(configuredTheme, defaultThemeId) + '. This theme is currently active on your public website.');
        }

        const selectedThemeId = themeSelect?.value ?? configuredThemeId;
        setThemeCoverageHint(buildThemeCoverageHint(themeData, selectedThemeId));
        setThemeSelectionWarning(buildThemeSelectionWarning(themeData, selectedThemeId));
        applyThemeDiagnostics(themeData, selectedThemeId);
      };

      const loadThemeStatus = () => fetch('/admin-api/system/themes')
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('failed')))
        .then((themeData) => {
          applyThemeStatus(themeData);
          setThemeStatus('Theme details are ready. Choose a theme to review what will happen before you save.');
          return themeData;
        })
        .catch(() => {
          setThemeState('Theme details are unavailable right now. Your website keeps using its current theme.');
          setThemeCoverageHint('Coverage hint: Coverage details are not available right now.');
          setThemeSelectionWarning('Theme details are temporarily unavailable. You can try again in a moment.');
          setThemeDiagnosticsSummary('Theme diagnostics: temporarily unavailable');
          setThemeDiagnosticsRows([
            'Theme diagnostics are not available right now.',
            'Your website will keep using the current theme until details can be loaded again.'
          ]);
          setThemeStatus('Theme details are temporarily unavailable. Refresh and try again.');
        });

      const load = () => fetch('/admin-api/settings')
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('failed')))
        .then((settings) => {
          fields.forEach((key) => {
            const input = document.getElementById(key);
            if (input) {
              input.value = settings?.[key] ?? '';
            }
          });
          setStatus('Settings loaded.');
        })
        .catch(() => {
          setStatus('Could not load settings. Refresh and try again.');
        });

      themeSelect?.addEventListener('change', () => {
        const selectedThemeId = themeSelect?.value ?? '';
        if (!currentThemeData) {
          setThemeCoverageHint('Coverage hint: Theme details are still loading.');
          setThemeSelectionWarning('Theme details are still loading.');
          return;
        }

        setThemeCoverageHint(buildThemeCoverageHint(currentThemeData, selectedThemeId));
        setThemeSelectionWarning(buildThemeSelectionWarning(currentThemeData, selectedThemeId));
        applyThemeDiagnostics(currentThemeData, selectedThemeId);
      });

      saveThemeButton?.addEventListener('click', () => {
        const themeId = themeSelect?.value ?? '';
        if (!themeId) {
          setThemeStatus('Choose a theme before saving.');
          return;
        }

        const configuredThemeId = currentThemeData?.configuredThemeId ?? '';
        if (themeId === configuredThemeId) {
          setThemeStatus('No changes were made. This theme is already active.');
          setThemeSelectionWarning(buildThemeSelectionWarning(currentThemeData, themeId));
          return;
        }

        setThemeStatus('Saving theme...');

        void fetch('/admin-api/system/themes', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ themeId })
        })
          .then(async (response) => {
            if (response.ok) {
              return response.json();
            }

            const payload = await response.json().catch(() => ({}));
            return Promise.reject(new Error(payload?.error?.message || 'Theme update failed.'));
          })
          .then((themeData) => {
            applyThemeStatus(themeData);

            const selectedTheme = Array.isArray(themeData?.themes)
              ? themeData.themes.find((theme) => theme?.id === themeData?.configuredThemeId)
              : null;
            const selectedThemeIncomplete = selectedTheme?.supportsAllCanonicalTemplates === false;

            if (themeData?.fallbackApplied === true) {
              setThemeStatus('Theme saved. Nimb is still using the default theme because the selected theme is not fully available right now.');
            } else if (selectedThemeIncomplete) {
              setThemeStatus('Theme saved and active. Some pages may still use the default theme because this theme is partial.');
            } else {
              setThemeStatus('Theme saved and active. Your public website now uses the selected theme.');
            }
          })
          .catch((error) => {
            const message = error instanceof Error && error.message ? error.message : 'Could not save theme. Please try again.';
            setThemeStatus('Could not save theme: ' + message);
          });
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
            setStatus('Settings saved. View your website to confirm the update.');
          })
          .catch(() => {
            setStatus('Could not save settings. Please try again in a moment.');
          });
      });

      void load();
      void loadThemeStatus();
    </script>`
});
