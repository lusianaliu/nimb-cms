import crypto from 'node:crypto';
import { issueToken, verifyToken } from './token.ts';
import { SessionStore } from './session-store.ts';

type AuthUser = Readonly<{ id: string, username: string, passwordHash: string, createdAt: string }>;
type AuthSession = Readonly<{ token: string, userId: string, issuedAt: string, expiresAt: string }>;

const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');

const freezeUsers = (users: AuthUser[]) => Object.freeze(users.map((entry) => Object.freeze({ ...entry })));
const freezeSessions = (sessions: AuthSession[]) => Object.freeze(sessions.map((entry) => Object.freeze({ ...entry })));

export class AuthService {
  sessionStore: SessionStore;
  mode: string;
  now: () => string;
  tokenSecret: string;
  users: readonly AuthUser[];
  sessions: readonly AuthSession[];
  onStateChange: (snapshot: { activeSessions: number, users: { id: string, username: string, createdAt: string }[], authHealth: string }) => void;

  constructor({ sessionStore, mode = 'development', now = () => new Date().toISOString(), tokenSecret = 'nimb-dev-token-secret', onStateChange = () => {} }: { sessionStore: SessionStore, mode?: string, now?: () => string, tokenSecret?: string, onStateChange?: (snapshot: { activeSessions: number, users: { id: string, username: string, createdAt: string }[], authHealth: string }) => void }) {
    this.sessionStore = sessionStore;
    this.mode = mode;
    this.now = now;
    this.tokenSecret = tokenSecret;
    this.users = Object.freeze([]);
    this.sessions = Object.freeze([]);
    this.onStateChange = onStateChange;
  }

  async restore() {
    const restored = await this.sessionStore.restore();
    this.users = freezeUsers((restored.users as AuthUser[]) ?? []);
    this.sessions = freezeSessions((restored.sessions as AuthSession[]) ?? []);

    if (this.mode === 'development' && this.users.length === 0) {
      await this.ensureBootstrapAdmin();
    }

    const snapshot = this.snapshot();
    this.onStateChange(snapshot);
    return snapshot;
  }

  async ensureBootstrapAdmin() {
    const admin: AuthUser = Object.freeze({
      id: 'user-admin',
      username: 'admin',
      passwordHash: hashPassword('admin'),
      createdAt: '1970-01-01T00:00:00.000Z'
    });

    this.users = freezeUsers([admin]);
    await this.persist();
    return admin;
  }

  async login({ username, password, ttlSeconds = 3600 }: { username: string, password: string, ttlSeconds?: number }) {
    const user = this.users.find((entry) => entry.username === username);
    if (!user || user.passwordHash !== hashPassword(password)) {
      return null;
    }

    const issuedAt = this.now();
    const expiresAt = new Date(new Date(issuedAt).getTime() + (ttlSeconds * 1000)).toISOString();
    const token = issueToken({ userId: user.id, issuedAt, expiresAt, secret: this.tokenSecret });

    this.sessions = freezeSessions([
      ...this.sessions.filter((entry) => entry.token !== token),
      Object.freeze({ token, userId: user.id, issuedAt, expiresAt })
    ]);

    await this.persist();

    return Object.freeze({ token, user: Object.freeze({ id: user.id, username: user.username }), issuedAt, expiresAt });
  }

  async logout(token: string) {
    const before = this.sessions.length;
    this.sessions = freezeSessions(this.sessions.filter((entry) => entry.token !== token));
    await this.persist();
    return before !== this.sessions.length;
  }

  getSession(token: string) {
    const payload = verifyToken({ token, secret: this.tokenSecret });
    if (!payload) {
      return null;
    }

    if (payload.expiresAt <= this.now()) {
      return null;
    }

    const active = this.sessions.find((entry) => entry.token === token && entry.userId === payload.userId);
    if (!active) {
      return null;
    }

    const user = this.users.find((entry) => entry.id === active.userId);
    if (!user) {
      return null;
    }

    return Object.freeze({
      token,
      user: Object.freeze({ id: user.id, username: user.username }),
      issuedAt: active.issuedAt,
      expiresAt: active.expiresAt
    });
  }

  snapshot() {
    return Object.freeze({
      activeSessions: this.sessions.length,
      users: this.users.map((entry) => Object.freeze({ id: entry.id, username: entry.username, createdAt: entry.createdAt })),
      authHealth: this.users.length > 0 ? 'ok' : 'degraded'
    });
  }

  async persist() {
    await this.sessionStore.save({
      users: this.users.map((entry) => ({ ...entry })),
      sessions: this.sessions.map((entry) => ({ ...entry }))
    });

    this.onStateChange(this.snapshot());
  }
}
