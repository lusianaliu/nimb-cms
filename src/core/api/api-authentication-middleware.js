import { parseCookies, respondJson } from './json-http.js';

export class ApiAuthenticationMiddleware {
  constructor(options = {}) {
    this.userSessions = options.userSessions ?? null;
    this.adminSessions = options.adminSessions ?? null;
    this.userCookieName = options.userCookieName ?? 'nimb_user_session';
    this.adminCookieName = options.adminCookieName ?? 'nimb_admin_session';
  }

  authenticate(req, res) {
    const cookies = parseCookies(req);

    const adminSession = this.adminSessions?.get(cookies[this.adminCookieName]);
    if (adminSession) {
      return { ok: true, actor: adminSession.subject, role: 'admin' };
    }

    const userSession = this.userSessions?.get(cookies[this.userCookieName]);
    if (userSession) {
      return { ok: true, actor: userSession.subject, role: 'user' };
    }

    respondJson(res, 401, {
      error: 'Authentication required',
      code: 'API_AUTH_REQUIRED'
    });

    return { ok: false };
  }
}
