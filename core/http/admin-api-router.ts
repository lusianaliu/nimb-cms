import { jsonResponse } from './response.ts';

const ADMIN_API_BASE_PATH = '/admin-api';

const DEFAULT_ADMIN_BRANDING = Object.freeze({
  adminTitle: 'Nimb Admin',
  logoText: 'Nimb'
});

const resolveSettings = (runtime) => {
  const entries = runtime?.contentStore?.list?.('settings') ?? [];
  return entries[0]?.data ?? {};
};

const resolveAdminBranding = (runtime) => {
  const settings = resolveSettings(runtime);
  return Object.freeze({
    adminTitle: typeof settings.adminTitle === 'string' && settings.adminTitle.trim() ? settings.adminTitle : DEFAULT_ADMIN_BRANDING.adminTitle,
    logoText: typeof settings.logoText === 'string' && settings.logoText.trim() ? settings.logoText : DEFAULT_ADMIN_BRANDING.logoText,
    logoUrl: typeof settings.logoUrl === 'string' && settings.logoUrl.trim() ? settings.logoUrl : undefined
  });
};

const resolveAdminTheme = (runtime) => {
  const settings = resolveSettings(runtime);
  if (typeof settings.adminTheme === 'string' && settings.adminTheme.trim()) {
    return settings.adminTheme;
  }

  return runtime?.adminTheme ?? 'default';
};

export const createAdminApiRouter = (runtime) => Object.freeze({
  dispatch(context) {
    if (context.method !== 'GET') {
      return null;
    }


    if (context.path === `${ADMIN_API_BASE_PATH}/pages`) {
      const pages = runtime?.adminRegistry?.getAdminPages?.() ?? [];
      return () => jsonResponse(pages);
    }

    if (context.path === `${ADMIN_API_BASE_PATH}/system`) {
      return () => jsonResponse({
        name: 'Nimb',
        version: runtime?.version ?? '0.0.0',
        mode: runtime?.mode ?? 'unknown',
        installed: true,
        adminTheme: resolveAdminTheme(runtime),
        adminBranding: resolveAdminBranding(runtime)
      });
    }

    return null;
  }
});
