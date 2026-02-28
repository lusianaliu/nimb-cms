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

  window.NimbAdmin = {
    slots,
    pages: [],
    activePageId: null
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

  const header = document.createElement('strong');
  header.textContent = 'Nimb Admin';
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

  void fetch('/admin-api/pages')
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
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLayout, { once: true });
} else {
  bootstrapLayout();
}
