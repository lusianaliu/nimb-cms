export type AdminPage = {
  id: string
  path: string
  title: string
  render: (req, res, runtime) => string | Promise<string>
};

const normalizePath = (input: string) => {
  const value = `${input ?? ''}`.trim();
  if (!value) {
    throw new Error('Admin page path is required');
  }

  return value.startsWith('/') ? value : `/${value}`;
};

export const createAdminPageRegistry = () => {
  const pages = new Map<string, AdminPage>();

  return Object.freeze({
    register(page: AdminPage) {
      const id = `${page?.id ?? ''}`.trim();
      if (!id) {
        throw new Error('Admin page id is required');
      }

      const routePath = normalizePath(page?.path);
      if (pages.has(routePath)) {
        throw new Error(`Admin page already exists: ${routePath}`);
      }

      if (typeof page?.render !== 'function') {
        throw new Error('Admin page render function is required');
      }

      pages.set(routePath, Object.freeze({
        ...page,
        id,
        path: routePath,
        title: `${page?.title ?? ''}`.trim() || id
      }));
    },

    get(routePath: string) {
      return pages.get(normalizePath(routePath));
    },

    list() {
      return [...pages.values()];
    }
  });
};
