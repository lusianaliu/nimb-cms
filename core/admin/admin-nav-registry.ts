export type AdminNavItem = {
  id: string
  label: string
  path: string
  order?: number
  capability?: string
};

const normalizeOrder = (order: unknown) => {
  if (typeof order === 'number' && Number.isFinite(order)) {
    return order;
  }

  return 100;
};

export const createAdminNavRegistry = () => {
  const items = new Map<string, AdminNavItem>();

  return Object.freeze({
    register(item: AdminNavItem) {
      const id = `${item?.id ?? ''}`.trim();
      if (!id) {
        throw new Error('Admin nav item id is required');
      }

      if (items.has(id)) {
        throw new Error(`Admin nav item already exists: ${id}`);
      }

      items.set(id, Object.freeze({
        ...item,
        id,
        order: normalizeOrder(item?.order)
      }));
    },

    list() {
      return [...items.values()].sort((left, right) => {
        const orderDiff = normalizeOrder(left?.order) - normalizeOrder(right?.order);
        if (orderDiff !== 0) {
          return orderDiff;
        }

        return `${left?.id ?? ''}`.localeCompare(`${right?.id ?? ''}`);
      });
    }
  });
};
