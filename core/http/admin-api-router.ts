import { jsonResponse } from './response.ts';

const ADMIN_API_BASE_PATH = '/admin-api';

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
        adminTheme: runtime?.adminTheme ?? 'default'
      });
    }

    return null;
  }
});
