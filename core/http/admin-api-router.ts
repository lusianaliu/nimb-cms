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

const getSetting = (runtime, key, fallback) => {
  try {
    const value = runtime?.settings?.get?.(key);
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  } catch {
    // Fallback to legacy storage reads.
  }

  return fallback();
};

const resolveAdminBranding = (runtime) => {
  const settings = resolveSettings(runtime);

  const adminTitle = getSetting(runtime, 'admin.branding.title', () => settings.adminTitle);
  const logoText = getSetting(runtime, 'admin.branding.logoText', () => settings.logoText);
  const logoUrl = getSetting(runtime, 'admin.branding.logoUrl', () => settings.logoUrl);

  return Object.freeze({
    adminTitle: typeof adminTitle === 'string' && adminTitle.trim() ? adminTitle : DEFAULT_ADMIN_BRANDING.adminTitle,
    logoText: typeof logoText === 'string' && logoText.trim() ? logoText : DEFAULT_ADMIN_BRANDING.logoText,
    logoUrl: typeof logoUrl === 'string' && logoUrl.trim() ? logoUrl : undefined
  });
};

const resolveAdminTheme = (runtime) => {
  const settings = resolveSettings(runtime);
  const adminTheme = getSetting(runtime, 'admin.theme', () => settings.adminTheme);

  if (typeof adminTheme === 'string' && adminTheme.trim()) {
    return adminTheme;
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
