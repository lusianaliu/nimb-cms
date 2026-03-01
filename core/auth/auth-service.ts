import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { issueToken, verifyToken } from './token.ts';
import { SessionStore } from './session-store.ts';

const scryptAsync = promisify(crypto.scrypt);
const USERS_FILE_PATH = path.resolve('/data/system/users.json');
const SCRYPT_PREFIX = 'scrypt';

type PasswordUser = Readonly<{ id: string, email: string, passwordHash: string, createdAt: string }>;

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

const ensureParentDirectory = async (filePath: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const safeParseUsers = (raw: string): PasswordUser[] => {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const record = entry as Record<string, unknown>;
        return Object.freeze({
          id: `${record.id ?? ''}`,
          email: `${record.email ?? ''}`,
          passwordHash: `${record.passwordHash ?? ''}`,
          createdAt: `${record.createdAt ?? ''}`
        });
      })
      .filter((entry) => entry.id && entry.email && entry.passwordHash && entry.createdAt);
  } catch {
    return [];
  }
};

const readUsers = async (): Promise<PasswordUser[]> => {
  try {
    const raw = await fs.readFile(USERS_FILE_PATH, 'utf8');
    return safeParseUsers(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const writeUsers = async (users: PasswordUser[]) => {
  await ensureParentDirectory(USERS_FILE_PATH);
  await fs.writeFile(USERS_FILE_PATH, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
};

const deriveScryptHash = async (password: string, salt: string) => {
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return `${SCRYPT_PREFIX}$${salt}$${derived.toString('hex')}`;
};

export const createAuthService = (runtime) => {
  const now = () => runtime?.clock?.() ?? new Date().toISOString();

  const findUserByEmail = async (email: string) => {
    const normalized = `${email ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const users = await readUsers();
    return users.find((entry) => entry.email.toLowerCase() === normalized) ?? null;
  };


  const findUserById = async (id: string) => {
    const normalized = `${id ?? ''}`.trim();
    if (!normalized) {
      return null;
    }

    const users = await readUsers();
    return users.find((entry) => entry.id === normalized) ?? null;
  };

  const createUser = async (email: string, password: string) => {
    const normalized = `${email ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email is required');
    }

    const users = await readUsers();
    if (users.some((entry) => entry.email.toLowerCase() === normalized)) {
      throw new Error('User already exists');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await deriveScryptHash(`${password ?? ''}`, salt);
    const user = Object.freeze({
      id: crypto.randomUUID(),
      email: normalized,
      passwordHash,
      createdAt: now()
    });

    await writeUsers([...users, user]);
    return user;
  };

  const verifyPassword = async (password: string, hash: string) => {
    const [prefix, salt, storedHex] = `${hash ?? ''}`.split('$');
    if (prefix !== SCRYPT_PREFIX || !salt || !storedHex) {
      return false;
    }

    const expected = await deriveScryptHash(`${password ?? ''}`, salt);
    const [, , computedHex] = expected.split('$');
    const stored = Buffer.from(storedHex, 'hex');
    const computed = Buffer.from(`${computedHex ?? ''}`, 'hex');

    if (stored.byteLength === 0 || computed.byteLength === 0 || stored.byteLength !== computed.byteLength) {
      return false;
    }

    return crypto.timingSafeEqual(stored, computed);
  };

  return Object.freeze({
    createUser,
    findUserByEmail,
    findUserById,
    verifyPassword
  });
};
