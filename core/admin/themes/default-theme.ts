import type { AdminTheme } from '../admin-theme-registry.ts';

const DEFAULT_THEME_STYLE_ID = 'nimb-admin-theme-default';

const DEFAULT_THEME_CSS = `
#admin-root {
  min-height: 100vh;
  background: var(--nimb-color-background);
  color: var(--nimb-color-text);
  font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

#admin-header,
#admin-footer {
  padding: 0.75rem 1rem;
  background: var(--nimb-color-surface);
  border-bottom: 1px solid #d8dee4;
}

#admin-footer {
  border-top: 1px solid #d8dee4;
  border-bottom: none;
  color: #52606d;
  font-size: 0.875rem;
}

#admin-sidebar,
#admin-main {
  padding: 1rem;
}

#admin-sidebar {
  background: var(--nimb-color-surface);
  border-right: 1px solid #d8dee4;
}

#admin-main {
  background: var(--nimb-color-background);
}

#admin-nav {
  margin: 0;
  padding: 0;
  list-style: none;
}

#admin-nav li {
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  color: #334e68;
}

#admin-nav li[data-active="true"] {
  background: var(--nimb-color-primary);
  color: var(--nimb-color-surface);
  font-weight: 600;
}
`;

export const createDefaultAdminTheme = (): AdminTheme => ({
  id: 'default',
  name: 'Default',
  variables: {
    colors: {
      primary: '#4f46e5',
      background: '#f9fafb',
      surface: '#ffffff',
      text: '#111827'
    }
  },
  apply({ document }) {
    if (!document) {
      return;
    }

    const existingStyle = document.getElementById(DEFAULT_THEME_STYLE_ID);
    if (existingStyle) {
      return;
    }

    const style = document.createElement('style');
    style.id = DEFAULT_THEME_STYLE_ID;
    style.textContent = DEFAULT_THEME_CSS;

    const head = document.head ?? document.getElementsByTagName('head')?.[0] ?? document.documentElement;
    head?.append(style);
  }
});
