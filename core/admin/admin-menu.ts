export type AdminMenuItem = {
  id: string
  title: string
  path: string
  icon: string
};

const normalizeItem = (item: AdminMenuItem): AdminMenuItem => {
  const id = `${item?.id ?? ''}`.trim();
  const title = `${item?.title ?? ''}`.trim();
  const path = `${item?.path ?? ''}`.trim();
  const icon = `${item?.icon ?? ''}`.trim();

  if (!id || !title || !path || !icon) {
    throw new Error('Admin menu item must include id, title, path, and icon');
  }

  return Object.freeze({
    id,
    title,
    path,
    icon
  });
};

export const createAdminMenuRegistry = () => {
  const items = new Map<string, AdminMenuItem>();

  return Object.freeze({
    register(item: AdminMenuItem) {
      const normalized = normalizeItem(item);

      if (items.has(normalized.id)) {
        throw new Error(`Admin menu item already exists: ${normalized.id}`);
      }

      items.set(normalized.id, normalized);
      return normalized;
    },

    list() {
      return [...items.values()].sort((left, right) => left.id.localeCompare(right.id));
    }
  });
};
