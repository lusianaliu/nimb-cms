const DEFAULT_NAVIGATION = Object.freeze([
  Object.freeze({ label: 'Home', url: '/' }),
  Object.freeze({ label: 'Blog', url: '/blog' })
]);

const htmlEscape = (value: unknown): string => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const toRenderableEntry = (entry) => {
  const data = entry?.data ?? {};
  return Object.freeze({
    title: `${data.title ?? 'Untitled'}`,
    slug: `${data.slug ?? ''}`,
    content: `${data.body ?? ''}`,
    updatedAt: entry?.updatedAt instanceof Date ? entry.updatedAt.toISOString() : `${entry?.updatedAt ?? ''}`
  });
};

const listEntries = (runtime, type, options = {}) => {
  try {
    return runtime?.contentQuery?.list?.(type, options) ?? [];
  } catch {
    return [];
  }
};

export const getLatestPosts = (runtime, limit = 10) => listEntries(runtime, 'post', {
  includeDrafts: false,
  sort: { field: 'updatedAt', direction: 'desc' },
  limit
}).map(toRenderableEntry);

export const getPostBySlug = (runtime, slug) => listEntries(runtime, 'post', { includeDrafts: false })
  .find((entry) => `${entry?.data?.slug ?? ''}` === `${slug}`);

export const getPageBySlug = (runtime, slug) => listEntries(runtime, 'page', { includeDrafts: false })
  .find((entry) => `${entry?.data?.slug ?? ''}` === `${slug}`);

const resolveSettingsEntry = (runtime) => (runtime?.contentStore?.list?.('settings') ?? [])[0]?.data ?? {};

const parseNavigationItems = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const resolveNavigation = (runtime) => {
  let entries = [];

  try {
    entries = runtime?.contentStore?.list?.('navigation') ?? [];
  } catch {
    entries = [];
  }

  const primary = entries.find((entry) => `${entry?.data?.slug ?? ''}` === 'primary');
  const items = parseNavigationItems(primary?.data?.items);

  if (!items) {
    return DEFAULT_NAVIGATION;
  }

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => Object.freeze({
      label: `${(item as Record<string, unknown>).label ?? ''}`,
      url: `${(item as Record<string, unknown>).url ?? '#'}`
    }));
};

const resolveSite = (runtime) => {
  const settings = resolveSettingsEntry(runtime);

  return Object.freeze({
    name: `${runtime?.settings?.get?.('site.name') ?? settings.siteName ?? 'My Nimb Site'}`,
    description: `${settings.siteDescription ?? 'A site powered by Nimb'}`
  });
};

export const createPublicRenderer = (runtime) => {
  const activeTheme = runtime?.theme?.activePublicTheme;

  return Object.freeze({
    renderTemplate(templateName: string, context) {
      const theme = activeTheme ?? runtime?.theme?.defaultPublicTheme;
      if (!theme || typeof theme.render !== 'function') {
        throw new Error('Public theme renderer is unavailable');
      }

      return theme.render(templateName, {
        ...context,
        htmlEscape
      });
    },
    renderRoute(route) {
      const site = resolveSite(runtime);
      const navigation = resolveNavigation(runtime);
      const context = Object.freeze({
        site,
        route: Object.freeze({
          path: route.path,
          params: Object.freeze({ ...(route.params ?? {}) })
        }),
        content: route.content,
        navigation
      });

      return this.renderTemplate(route.template, context);
    }
  });
};
