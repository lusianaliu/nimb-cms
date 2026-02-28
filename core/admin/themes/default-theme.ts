import type { AdminTheme } from '../admin-theme-registry.ts';

const DEFAULT_THEME_STYLE_ID = 'nimb-admin-theme-default';

const DEFAULT_THEME_CSS = `
#admin-root {
  min-height: 100vh;
  background: #f4f5f7;
  color: #1f2933;
  font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

#admin-header,
#admin-footer {
  padding: 0.75rem 1rem;
  background: #ffffff;
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
  background: #ffffff;
  border-right: 1px solid #d8dee4;
}

#admin-main {
  background: #f8fafc;
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
  background: #d9e2ec;
  font-weight: 600;
}
`;

export const createDefaultAdminTheme = (): AdminTheme => ({
  id: 'default',
  name: 'Default',
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
