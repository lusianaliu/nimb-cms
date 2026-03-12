import { jsonResponse } from './response.ts';

const ADMIN_API_BASE_PATH = '/admin-api';

const DEFAULT_ADMIN_BRANDING = Object.freeze({
  adminTitle: 'Nimb Admin',
  logoText: 'Nimb'
});

const readJsonBody = async (request): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const jsonErrorResponse = (statusCode: number, code: string, message: string) => jsonResponse({
  error: {
    code,
    message
  }
}, { statusCode });

const resolveSettings = (runtime) => runtime?.settings?.getSettings?.() ?? {};

const getSetting = (runtime, key, fallback) => {
  try {
    const value = runtime?.settings?.get?.(key);
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  } catch {
    // Fallback to storage reads.
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
    if (context.path === `${ADMIN_API_BASE_PATH}/settings` && context.method === 'GET') {
      return () => jsonResponse(resolveSettings(runtime));
    }

    if (context.path === `${ADMIN_API_BASE_PATH}/settings` && context.method === 'PUT') {
      return async (requestContext) => {
        const payload = await readJsonBody(requestContext.request);
        const settings = await runtime?.settings?.updateSettings?.(payload);
        return jsonResponse(settings ?? resolveSettings(runtime));
      };
    }

    if (context.path === `${ADMIN_API_BASE_PATH}/system/themes`) {
      if (context.method === 'PUT') {
        return async (requestContext) => {
          const payload = await readJsonBody(requestContext.request);
          const themeId = payload?.themeId;

          try {
            const status = runtime?.themes?.setConfiguredThemeId?.(themeId);
            return jsonResponse(status ?? runtime?.themes?.getStatus?.() ?? {
              configuredThemeId: 'default',
              resolvedThemeId: 'default',
              defaultThemeId: 'default',
              fallbackApplied: false,
              themes: []
            });
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
              return jsonErrorResponse(400, `${error.code}`, `${error.message}`);
            }

            return jsonErrorResponse(500, 'THEME_UPDATE_FAILED', 'Failed to update active theme.');
          }
        };
      }

      if (context.method !== 'GET') {
        return null;
      }

      return () => jsonResponse(runtime?.themes?.getStatus?.() ?? {
        configuredThemeId: 'default',
        resolvedThemeId: 'default',
        defaultThemeId: 'default',
        fallbackApplied: false,
        themes: []
      });
    }

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
    if (context.path === `${ADMIN_API_BASE_PATH}/system/info`) {
      const siteName = getSetting(runtime, 'site.name', () => 'My Nimb Site');
      const version = getSetting(runtime, 'site.version', () => runtime?.version ?? '0.0.0');
      const installedAt = runtime?.system?.config?.installedAt ?? null;

      return () => jsonResponse({
        siteName: typeof siteName === 'string' && siteName.trim() ? siteName : 'My Nimb Site',
        version: typeof version === 'string' && version.trim() ? version : runtime?.version ?? '0.0.0',
        installedAt: typeof installedAt === 'string' ? installedAt : null
      });
    }

    return null;
  }
});
