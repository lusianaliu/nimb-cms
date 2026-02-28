export type AdminPage = {
  id: string
  path: string
  title: string
};

const registry: AdminPage[] = [];

const normalizePage = (page: AdminPage): AdminPage => {
  const id = String(page?.id ?? '').trim();
  const path = String(page?.path ?? '').trim();
  const title = String(page?.title ?? '').trim();

  if (!id || !path || !title) {
    throw new TypeError('Admin page must include id, path, and title');
  }

  return Object.freeze({ id, path, title });
};

export const registerAdminPage = (page: AdminPage) => {
  const normalizedPage = normalizePage(page);
  const existingIndex = registry.findIndex((entry) => entry.id === normalizedPage.id);

  if (existingIndex >= 0) {
    registry[existingIndex] = normalizedPage;
    return normalizedPage;
  }

  registry.push(normalizedPage);
  return normalizedPage;
};

export const getAdminPages = () => registry.map((page) => Object.freeze({ ...page }));
