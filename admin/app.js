const DEFAULT_ADMIN_THEME_ID = 'default';
const DEFAULT_ADMIN_THEME_STYLE_ID = 'nimb-admin-theme-default';
const ADMIN_THEME_VARIABLES_STYLE_ID = 'admin-theme-vars';
const DEFAULT_ADMIN_BRANDING = Object.freeze({
  adminTitle: 'Nimb Admin',
  logoText: 'Nimb'
});

const DEFAULT_ADMIN_THEME = {
  id: DEFAULT_ADMIN_THEME_ID,
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
    const existingStyle = document.getElementById(DEFAULT_ADMIN_THEME_STYLE_ID);
    if (existingStyle) {
      return;
    }

    const style = document.createElement('style');
    style.id = DEFAULT_ADMIN_THEME_STYLE_ID;
    style.textContent = `
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

    const head = document.head ?? document.getElementsByTagName?.('head')?.[0] ?? document.getElementById('admin-root') ?? document.body;
    if (head?.append) {
      head.append(style);
    }
  }
};

const createAdminThemeRegistry = () => {
  const themes = new Map([[DEFAULT_ADMIN_THEME.id, DEFAULT_ADMIN_THEME]]);

  const register = (theme) => {
    const id = String(theme?.id ?? '').trim();
    const name = String(theme?.name ?? '').trim();

    if (!id || !name || typeof theme?.apply !== 'function') {
      throw new TypeError('Admin theme must include id, name, and apply(context)');
    }

    if (themes.has(id)) {
      throw new Error(`Admin theme already registered: ${id}`);
    }

    const normalizedTheme = Object.freeze({ id, name, variables: theme.variables, apply: theme.apply });
    themes.set(id, normalizedTheme);
    return normalizedTheme;
  };

  const getDefault = () => themes.get(DEFAULT_ADMIN_THEME_ID) ?? DEFAULT_ADMIN_THEME;

  const get = (id) => {
    const themeId = String(id ?? '').trim();
    if (!themeId) {
      return getDefault();
    }

    return themes.get(themeId) ?? getDefault();
  };

  return Object.freeze({ register, get, getDefault });
};


const DEFAULT_THEME_VARIABLES = Object.freeze({
  colors: Object.freeze({
    primary: '#4f46e5',
    background: '#f9fafb',
    surface: '#ffffff',
    text: '#111827'
  })
});

const normalizeThemeVariables = (variables) => {
  const colors = variables?.colors ?? {};

  return Object.freeze({
    colors: Object.freeze({
      primary: String(colors.primary ?? '').trim() || DEFAULT_THEME_VARIABLES.colors.primary,
      background: String(colors.background ?? '').trim() || DEFAULT_THEME_VARIABLES.colors.background,
      surface: String(colors.surface ?? '').trim() || DEFAULT_THEME_VARIABLES.colors.surface,
      text: String(colors.text ?? '').trim() || DEFAULT_THEME_VARIABLES.colors.text
    })
  });
};

const applyThemeVariables = ({ document, variables }) => {
  const resolved = normalizeThemeVariables(variables);
  const cssText = `:root {
  --nimb-color-primary: ${resolved.colors.primary};
  --nimb-color-background: ${resolved.colors.background};
  --nimb-color-surface: ${resolved.colors.surface};
  --nimb-color-text: ${resolved.colors.text};
}`;

  const existingStyle = document.getElementById(ADMIN_THEME_VARIABLES_STYLE_ID);
  if (existingStyle) {
    existingStyle.textContent = cssText;
    return resolved;
  }

  const style = document.createElement('style');
  style.id = ADMIN_THEME_VARIABLES_STYLE_ID;
  style.textContent = cssText;

  const head = document.head ?? document.getElementsByTagName?.('head')?.[0] ?? document.getElementById('admin-root') ?? document.body;
  if (head?.append) {
    head.append(style);
  }

  return resolved;
};

const normalizeAdminBranding = (branding) => {
  const candidate = branding ?? {};

  return Object.freeze({
    adminTitle: String(candidate.adminTitle ?? '').trim() || DEFAULT_ADMIN_BRANDING.adminTitle,
    logoText: String(candidate.logoText ?? '').trim() || DEFAULT_ADMIN_BRANDING.logoText,
    logoUrl: String(candidate.logoUrl ?? '').trim()
  });
};

const applyAdminBranding = ({ document, branding, slots }) => {
  const resolved = normalizeAdminBranding(branding);
  document.title = resolved.adminTitle;

  const header = slots?.header;
  const brandNode = header?.querySelector?.('#admin-brand');

  if (!brandNode || typeof brandNode.replaceChildren !== 'function') {
    return resolved;
  }

  if (resolved.logoUrl) {
    const image = document.createElement('img');
    image.setAttribute('src', resolved.logoUrl);
    image.setAttribute('alt', resolved.logoText);
    brandNode.replaceChildren(image);
    return resolved;
  }

  const text = document.createElement('strong');
  text.textContent = resolved.logoText;
  brandNode.replaceChildren(text);
  return resolved;
};

const createSystemInfoElement = (system) => {
  const container = document.createElement('section');

  const lines = [
    `Name: ${system.name ?? 'Unknown'}`,
    `Version: ${system.version ?? 'Unknown'}`,
    `Mode: ${system.mode ?? 'Unknown'}`,
    `Installed: ${system.installed === true ? 'Yes' : 'No'}`
  ];

  container.innerHTML = lines.join('<br>');
  return container;
};

const createPlaceholderElement = (page) => {
  const container = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = page.title;
  const description = document.createElement('p');
  description.textContent = `Admin page: ${page.id}`;

  container.append(title, description);
  return container;
};

const bootstrapLayout = () => {
  const slots = {
    header: document.getElementById('admin-header'),
    sidebar: document.getElementById('admin-sidebar'),
    main: document.getElementById('admin-main'),
    footer: document.getElementById('admin-footer')
  };

  const adminThemes = createAdminThemeRegistry();

  window.NimbAdmin = {
    slots,
    pages: [],
    activePageId: null,
    themes: adminThemes
  };

  const setSlot = (name, element) => {
    const slot = window.NimbAdmin?.slots?.[name];

    if (!slot) {
      return;
    }

    slot.replaceChildren();
    if (element) {
      slot.append(element);
    }
  };

  const clearSlot = (name) => {
    const slot = window.NimbAdmin?.slots?.[name];

    if (!slot) {
      return;
    }

    slot.replaceChildren();
  };

  window.NimbAdmin.setSlot = setSlot;
  window.NimbAdmin.clearSlot = clearSlot;

  const header = document.createElement('div');
  const headerBrand = document.createElement('div');
  headerBrand.id = 'admin-brand';
  header.append(headerBrand);
  setSlot('header', header);

  const footer = document.createElement('small');
  footer.textContent = 'Nimb CMS Runtime';
  setSlot('footer', footer);

  const renderPageContent = (page) => {
    const pageContext = {
      slots: window.NimbAdmin?.slots,
      router,
      page,
      apiBase: '/admin-api'
    };

    if (typeof page?.render === 'function') {
      const rendered = page.render(pageContext);
      setSlot('main', rendered ?? null);
      return;
    }

    if (page.id === 'system') {
      const systemFallback = document.createElement('p');
      systemFallback.textContent = 'System information unavailable.';
      setSlot('main', systemFallback);

      void fetch('/admin-api/system')
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load system info: ${response.status}`);
          }

          return response.json();
        })
        .then((system) => {
          if (window.NimbAdmin?.activePageId !== page.id) {
            return;
          }

          setSlot('main', createSystemInfoElement(system));
        })
        .catch(() => {
          // Leave fallback content in place.
        });

      return;
    }

    setSlot('main', createPlaceholderElement(page));
  };

  let currentPage = null;

  const activatePage = (page) => {
    const previousPage = currentPage;

    if (previousPage && previousPage.id !== page.id && typeof previousPage.onUnmount === 'function') {
      previousPage.onUnmount({
        slots: window.NimbAdmin?.slots,
        router,
        page: previousPage,
        apiBase: '/admin-api'
      });
    }

    window.NimbAdmin.activePageId = page.id;
    renderPageContent(page);

    currentPage = page;
    if (typeof page.onMount === 'function') {
      page.onMount({
        slots: window.NimbAdmin?.slots,
        router,
        page,
        apiBase: '/admin-api'
      });
    }
  };

  const router = {
    getPageFromUrl: () => {
      const pathname = window.location?.pathname ?? '';
      const match = pathname.match(/^\/admin\/([^/]+)$/);

      if (!match) {
        return null;
      }

      return match[1];
    },
    syncNavigation: (pageId) => {
      const navItems = window.NimbAdmin?.slots?.sidebar?.querySelectorAll?.('li[data-page]') ?? [];
      navItems.forEach((item) => {
        if (item.getAttribute('data-page') === pageId) {
          item.setAttribute('data-active', 'true');
          return;
        }

        item.removeAttribute('data-active');
      });
    },
    handleLocation: () => {
      const pages = window.NimbAdmin?.pages ?? [];

      if (pages.length === 0) {
        return;
      }

      const pageFromUrl = router.getPageFromUrl();
      const targetPage = pages.find((page) => page.id === pageFromUrl) ?? pages[0];

      activatePage(targetPage);
      router.syncNavigation(targetPage.id);
    },
    navigate: (pageId) => {
      const pages = window.NimbAdmin?.pages ?? [];
      const targetPage = pages.find((page) => page.id === pageId);

      if (!targetPage) {
        router.handleLocation();
        return;
      }

      window.history?.pushState?.({}, '', `/admin/${targetPage.id}`);
      activatePage(targetPage);
      router.syncNavigation(targetPage.id);
    }
  };

  const renderNavigation = (pages) => {
    const nav = document.createElement('ul');
    nav.id = 'admin-nav';

    pages.forEach((page) => {
      const item = document.createElement('li');
      item.textContent = page.title;
      item.setAttribute('data-page', page.id);
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        router.navigate(page.id);
      });
      nav.append(item);
    });

    setSlot('sidebar', nav);
  };

  window.NimbAdmin.renderNavigation = renderNavigation;
  window.NimbAdmin.activatePage = activatePage;
  window.NimbAdmin.renderPageContent = renderPageContent;
  window.NimbAdmin.router = router;

  window.addEventListener?.('popstate', router.handleLocation);

  const loadPages = () => fetch('/admin-api/pages')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load admin pages: ${response.status}`);
      }

      return response.json();
    })
    .then((pages) => {
      const adminPages = Array.isArray(pages) ? pages : [];
      window.NimbAdmin.pages = adminPages;
      renderNavigation(adminPages);

      if (adminPages.length > 0) {
        router.handleLocation();
        return;
      }

      const emptyState = document.createElement('p');
      emptyState.textContent = 'No admin pages available.';
      setSlot('main', emptyState);
    })
    .catch(() => {
      const loadFailure = document.createElement('p');
      loadFailure.textContent = 'Failed to load admin pages.';
      setSlot('sidebar', null);
      setSlot('main', loadFailure);
    });

  void fetch('/admin-api/system')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load admin system metadata: ${response.status}`);
      }

      return response.json();
    })
    .then((system) => {
      const themeId = String(system?.adminTheme ?? DEFAULT_ADMIN_THEME_ID);
      const theme = adminThemes.get(themeId);
      theme.apply({
        document,
        slots
      });

      applyThemeVariables({
        document,
        variables: theme.variables
      });

      applyAdminBranding({
        document,
        branding: system?.adminBranding,
        slots
      });
    })
    .catch(() => {
      const fallbackTheme = adminThemes.getDefault();
      fallbackTheme.apply({
        document,
        slots
      });

      applyThemeVariables({
        document,
        variables: fallbackTheme.variables
      });

      applyAdminBranding({
        document,
        branding: DEFAULT_ADMIN_BRANDING,
        slots
      });
    })
    .finally(() => {
      void loadPages();
    });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLayout, { once: true });
} else {
  bootstrapLayout();
}
