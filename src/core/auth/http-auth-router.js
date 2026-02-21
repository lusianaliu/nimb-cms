const JSON_HEADER = { 'Content-Type': 'application/json' };

export class HttpAuthRouter {
  constructor(options) {
    this.logger = options.logger;
    this.securityConfig = options.securityConfig;
    this.userAuthService = options.userAuthService;
    this.adminAuthService = options.adminAuthService;
    this.userSessions = options.userSessions;
    this.adminSessions = options.adminSessions;
    this.roleManagementService = options.roleManagementService;
    this.authorizationMiddleware = options.authorizationMiddleware;

    this.userCookieName = 'nimb_user_session';
    this.adminCookieName = 'nimb_admin_session';

    this.adminPath = `/${this.securityConfig.adminPath}`;
    this.adminLoginPath = `/${this.securityConfig.adminLoginPath}`;

    this.requireAdminPanelCapability = this.authorizationMiddleware.requireCapability('nimb.admin.panel.read', {
      resolveSubjectId: (req) => this.resolveAdminSubjectId(req),
      unauthenticatedPayload: {
        error: 'Admin authentication required',
        loginPath: this.adminLoginPath
      },
      forbiddenPayload: {
        error: 'Admin permission denied'
      }
    });
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'POST' && path === '/register') {
      return this.handleRegister(req, res, this.userAuthService);
    }

    if (req.method === 'POST' && path === '/login') {
      return this.handleLogin(req, res, this.userAuthService, this.userSessions, this.userCookieName);
    }

    if (req.method === 'POST' && path === '/logout') {
      return this.handleLogout(req, res, this.userSessions, this.userCookieName);
    }

    if (req.method === 'GET' && path === '/session') {
      return this.handleSession(req, res, this.userSessions, this.userCookieName);
    }

    if (req.method === 'POST' && path === `${this.adminPath}/register`) {
      return this.handleAdminRegister(req, res);
    }

    if (req.method === 'POST' && path === this.adminLoginPath) {
      return this.handleAdminLogin(req, res);
    }

    if (req.method === 'POST' && path === `${this.adminPath}/logout`) {
      return this.handleLogout(req, res, this.adminSessions, this.adminCookieName);
    }

    if (req.method === 'GET' && path === this.adminPath) {
      return this.handleAdminPanel(req, res);
    }

    return false;
  }

  async handleRegister(req, res, authService) {
    const payload = await this.readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = authService.register(payload);
    if (!result.ok) {
      this.respond(res, 400, { error: result.error });
      return true;
    }

    this.respond(res, 201, { registered: true, user: result.user });
    return true;
  }

  async handleAdminRegister(req, res) {
    const payload = await this.readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.adminAuthService.register(payload);
    if (!result.ok) {
      this.respond(res, 400, { error: result.error });
      return true;
    }

    this.assignBootstrapRole(result.user.username);
    this.respond(res, 201, { registered: true, user: result.user });
    return true;
  }

  async handleLogin(req, res, authService, sessionStore, cookieName) {
    const payload = await this.readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = authService.login(payload);
    if (!result.ok) {
      this.respond(res, 401, { error: result.error });
      return true;
    }

    const sessionId = sessionStore.create(result.user);
    res.setHeader('Set-Cookie', `${cookieName}=${sessionId}; HttpOnly; Path=/; SameSite=Lax`);
    this.respond(res, 200, { authenticated: true, user: result.user });
    return true;
  }

  async handleAdminLogin(req, res) {
    const payload = await this.readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.adminAuthService.login(payload);
    if (!result.ok) {
      this.respond(res, 401, { error: result.error });
      return true;
    }

    this.assignBootstrapRole(result.user.username);

    const sessionId = this.adminSessions.create(result.user);
    res.setHeader('Set-Cookie', `${this.adminCookieName}=${sessionId}; HttpOnly; Path=/; SameSite=Lax`);
    this.respond(res, 200, { authenticated: true, user: result.user });
    return true;
  }

  handleLogout(req, res, sessionStore, cookieName) {
    const cookies = this.readCookies(req);
    sessionStore.delete(cookies[cookieName]);
    res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
    this.respond(res, 200, { loggedOut: true });
    return true;
  }

  handleSession(req, res, sessionStore, cookieName) {
    const cookies = this.readCookies(req);
    const session = sessionStore.get(cookies[cookieName]);

    if (!session) {
      this.respond(res, 401, { authenticated: false });
      return true;
    }

    this.respond(res, 200, {
      authenticated: true,
      user: session.subject,
      createdAt: session.createdAt
    });
    return true;
  }

  handleAdminPanel(req, res) {
    if (!this.requireAdminPanelCapability(req, res)) {
      return true;
    }

    const cookies = this.readCookies(req);
    const session = this.adminSessions.get(cookies[this.adminCookieName]);

    this.respond(res, 200, {
      authenticated: true,
      admin: session.subject,
      route: this.adminPath
    });
    return true;
  }

  assignBootstrapRole(subjectId) {
    if (!subjectId) {
      return;
    }

    this.roleManagementService.assignRole(subjectId, this.securityConfig.adminBootstrapRoleId);
  }

  resolveAdminSubjectId(req) {
    const cookies = this.readCookies(req);
    const session = this.adminSessions.get(cookies[this.adminCookieName]);
    return session?.subject?.username ?? null;
  }

  readCookies(req) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return {};
    }

    return cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .reduce((acc, part) => {
        const index = part.indexOf('=');
        if (index === -1) {
          return acc;
        }

        const name = part.slice(0, index);
        const value = part.slice(index + 1);
        acc[name] = value;
        return acc;
      }, {});
  }

  async readJsonBody(req, res) {
    const body = await new Promise((resolve, reject) => {
      let data = '';

      req.on('data', (chunk) => {
        data += chunk;
      });

      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    if (!body) {
      return {};
    }

    try {
      return JSON.parse(body);
    } catch (error) {
      this.logger.warn('Invalid JSON payload', { error: error.message });
      this.respond(res, 400, { error: 'Invalid JSON payload' });
      return null;
    }
  }

  respond(res, statusCode, payload) {
    res.writeHead(statusCode, JSON_HEADER);
    res.end(JSON.stringify(payload));
  }
}
