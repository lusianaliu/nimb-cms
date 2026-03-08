const normalizeId = (id: string) => `${id ?? ''}`.trim();

const assertRegisteredType = (contentApi, type: string) => {
  const normalizedType = `${type ?? ''}`.trim();
  if (!normalizedType || !contentApi.getTypeSchema(normalizedType)) {
    throw new Error(`Unsupported content type: ${normalizedType}`);
  }

  return normalizedType;
};

export const createContentAdminService = (runtime) => {
  const contentApi = runtime?.content;

  if (!contentApi) {
    throw new Error('Runtime content API is unavailable');
  }

  return Object.freeze({
    listEntries(type: string) {
      const normalizedType = assertRegisteredType(contentApi, type);
      return contentApi.listEntries(normalizedType);
    },
    getEntry(type: string, id: string) {
      const normalizedType = assertRegisteredType(contentApi, type);
      return contentApi.getEntry(normalizedType, normalizeId(id));
    },
    async createEntry(type: string, data: Record<string, unknown>) {
      const normalizedType = assertRegisteredType(contentApi, type);
      const created = await contentApi.createEntry(normalizedType, data);
      contentApi.invalidateRenderCache?.();
      return created;
    },
    async updateEntry(type: string, id: string, data: Record<string, unknown>) {
      const normalizedType = assertRegisteredType(contentApi, type);
      const updated = await contentApi.updateEntry(normalizedType, normalizeId(id), data);
      contentApi.invalidateRenderCache?.();
      return updated;
    },
    async deleteEntry(type: string, id: string) {
      const normalizedType = assertRegisteredType(contentApi, type);
      await contentApi.deleteEntry(normalizedType, normalizeId(id));
      contentApi.invalidateRenderCache?.();
    }
  });
};
