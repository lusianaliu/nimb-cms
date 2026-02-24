import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

type AdminState = Readonly<{ username: string, passwordHash: string }>;

type SessionRecord = Readonly<{ token: string, username: string, issuedAt: string }>;

const ADMIN_STATE_FILE = 'admin.json';
const SESSION_COOKIE = 'nimb_admin_session';

const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');

const readAdminState = (projectPaths: { persistenceDir?: string, projectRoot?: string }) => {
  const persistenceDir = projectPaths?.persistenceDir ?? path.join(projectPaths?.projectRoot ?? process.cwd(), '.nimb');
  const statePath = path.join(persistenceDir, ADMIN_STATE_FILE);

  if (!fs.existsSync(statePath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8')) as Record<string, unknown>;
  if (typeof parsed.username !== 'string' || typeof parsed.passwordHash !== 'string') {
    return null;
  }

  return Object.freeze({ username: parsed.username, passwordHash: parsed.passwordHash });
};

const parseCookies = (cookieHeader: string | undefined) => {
  if (!cookieHeader || cookieHeader.trim() === '') {
    return Object.freeze({});
  }

  const values = cookieHeader.split(';').map((entry) => entry.trim()).filter(Boolean);
  const pairs = values.map((entry) => {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex < 0) {
      return null;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    return key ? [key, decodeURIComponent(value)] : null;
  }).filter(Boolean);

  return Object.freeze(Object.fromEntries(pairs as [string, string][]));
};

const createSessionToken = ({ username, issuedAt, secret }: { username: string, issuedAt: string, secret: string }) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = Buffer.from(JSON.stringify({ username, issuedAt, nonce }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const verifySessionToken = ({ token, secret }: { token: string, secret: string }) => {
  const [payload, signature] = `${token}`.split('.');

  if (!payload || !signature) {
    return null;
  }

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (signature !== expected) {
    return null;
  }

  return token;
};

export const createAdminAuth = ({ projectPaths, tokenSecret = 'nimb-admin-session-secret', now = () => new Date().toISOString(), sessionCookiePath = '/admin' }: { projectPaths: { persistenceDir?: string, projectRoot?: string }, tokenSecret?: string, now?: () => string, sessionCookiePath?: string }) => {
  const adminState = readAdminState(projectPaths);
  const sessionMap = new Map<string, SessionRecord>();

  const login = ({ username, password }: { username: string, password: string }) => {
    if (!adminState || adminState.username !== username || adminState.passwordHash !== hashPassword(password)) {
      return null;
    }

    const issuedAt = now();
    const token = createSessionToken({ username, issuedAt, secret: tokenSecret });
    sessionMap.set(token, Object.freeze({ token, username, issuedAt }));
    return token;
  };

  const getSessionFromRequest = (request: { headers: Record<string, string | string[] | undefined> }) => {
    const cookieHeader = request?.headers?.cookie;
    const cookieValue = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
    const cookies = parseCookies(cookieValue);
    const token = cookies[SESSION_COOKIE];

    if (!token) {
      return null;
    }

    const verified = verifySessionToken({ token, secret: tokenSecret });
    if (!verified) {
      return null;
    }

    return sessionMap.get(verified) ?? null;
  };

  return Object.freeze({
    login,
    getSessionFromRequest,
    cookieName: SESSION_COOKIE,
    sessionCookiePath,
    hasAdminCredentials: Boolean(adminState)
  });
};
