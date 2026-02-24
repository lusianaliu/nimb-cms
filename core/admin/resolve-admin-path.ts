const normalizeAdminMount = (basePath) => {
  const value = String(basePath ?? '/admin').trim() || '/admin';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/g, '') || '/';
};

export const resolveAdminBasePath = (runtime) => {
  const config = runtime?.getConfig?.() ?? runtime?.config ?? {};
  return normalizeAdminMount(config?.admin?.basePath);
};
