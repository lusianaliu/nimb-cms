const SUPPORTED_TYPES = new Set(['page', 'post']);

const assertSupportedType = (type: string) => {
  if (!SUPPORTED_TYPES.has(type)) {
    throw new Error(`Unsupported content type: ${type}`);
  }
};

const normalizeId = (id: string) => `${id ?? ''}`.trim();

export const createContentAdminService = (runtime) => {
  const contentApi = runtime?.content;

  if (!contentApi) {
    throw new Error('Runtime content API is unavailable');
  }

  return Object.freeze({
    listEntries(type: string) {
      assertSupportedType(type);
      return contentApi.listEntries(type);
    },
    getEntry(type: string, id: string) {
      assertSupportedType(type);
      return contentApi.getEntry(type, normalizeId(id));
    },
    async createEntry(type: string, data: Record<string, unknown>) {
      assertSupportedType(type);
      const created = await contentApi.createEntry(type, data);
      contentApi.invalidateRenderCache?.();
      return created;
    },
    async updateEntry(type: string, id: string, data: Record<string, unknown>) {
      assertSupportedType(type);
      const updated = await contentApi.updateEntry(type, normalizeId(id), data);
      contentApi.invalidateRenderCache?.();
      return updated;
    },
    async deleteEntry(type: string, id: string) {
      assertSupportedType(type);
      await contentApi.deleteEntry(type, normalizeId(id));
      contentApi.invalidateRenderCache?.();
    }
  });
};
