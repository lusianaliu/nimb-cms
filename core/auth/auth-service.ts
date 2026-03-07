import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { issueToken, verifyToken } from './token.ts';
import { SessionStore } from './session-store.ts';

const scryptAsync = promisify(crypto.scrypt);
const USERS_FILE_PATH = path.join('data', 'users.json');
const LEGACY_USERS_FILE_PATH = path.resolve('/data/system/users.json');
const SCRYPT_PREFIX = 'scrypt';

type PasswordUser = Readonly<{
  id: string
  username: string
  email: string
  passwordHash: string
  createdAt: string
  passwordChangedAt?: string | null
}>;

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
        const hasPasswordChangedAt = Object.prototype.hasOwnProperty.call(record, 'passwordChangedAt');
        return Object.freeze({
          id: `${record.id ?? ''}`,
          username: typeof record.username === 'string' ? record.username : 'admin',
          email: `${record.email ?? ''}`,
          passwordHash: `${record.passwordHash ?? ''}`,
          createdAt: `${record.createdAt ?? ''}`,
          passwordChangedAt: typeof record.passwordChangedAt === 'string'
            ? record.passwordChangedAt
            : (hasPasswordChangedAt ? null : `${record.createdAt ?? ''}`)
        });
      })
      .filter((entry) => entry.id && entry.username && entry.email && entry.passwordHash && entry.createdAt);
  } catch {
    return [];
  }
};

const readUsers = async (usersFilePath: string, legacyUsersFilePath: string): Promise<PasswordUser[]> => {
  try {
    const raw = await fs.readFile(usersFilePath, 'utf8');
    return safeParseUsers(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      try {
        const rawLegacy = await fs.readFile(legacyUsersFilePath, 'utf8');
        return safeParseUsers(rawLegacy);
      } catch (legacyError) {
        if ((legacyError as NodeJS.ErrnoException)?.code === 'ENOENT') {
          return [];
        }

        throw legacyError;
      }
    }

    throw error;
  }
};

const writeUsers = async (usersFilePath: string, users: PasswordUser[]) => {
  await ensureParentDirectory(usersFilePath);
  await fs.writeFile(usersFilePath, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
};

const deriveScryptHash = async (password: string, salt: string) => {
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return `${SCRYPT_PREFIX}$${salt}$${derived.toString('hex')}`;
};

export const createAuthService = (runtime) => {
  const now = () => runtime?.clock?.() ?? new Date().toISOString();
  const projectRoot = runtime?.projectPaths?.projectRoot ?? runtime?.project?.projectRoot ?? process.cwd();
  const usersFilePath = path.join(projectRoot, USERS_FILE_PATH);
  const legacyUsersFilePath = LEGACY_USERS_FILE_PATH;

  const findUserByEmail = async (email: string) => {
    const normalized = `${email ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const users = await readUsers(usersFilePath, legacyUsersFilePath);
    return users.find((entry) => entry.email.toLowerCase() === normalized) ?? null;
  };


  const findUserById = async (id: string) => {
    const normalized = `${id ?? ''}`.trim();
    if (!normalized) {
      return null;
    }

    const users = await readUsers(usersFilePath, legacyUsersFilePath);
    return users.find((entry) => entry.id === normalized) ?? null;
  };

  const createUser = async (emailOrInput: string | { username?: string, email: string, password: string, requirePasswordChange?: boolean }, passwordInput?: string) => {
    const input = typeof emailOrInput === 'string'
      ? { email: emailOrInput, password: `${passwordInput ?? ''}` }
      : emailOrInput;

    const normalized = `${input?.email ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email is required');
    }

    const username = `${input?.username ?? 'admin'}`.trim() || 'admin';

    const users = await readUsers(usersFilePath, legacyUsersFilePath);
    if (users.some((entry) => entry.email.toLowerCase() === normalized)) {
      throw new Error('User already exists');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await deriveScryptHash(`${input?.password ?? ''}`, salt);
    const createdAt = now();
    const user = Object.freeze({
      id: crypto.randomUUID(),
      username,
      email: normalized,
      passwordHash,
      createdAt,
      passwordChangedAt: input?.requirePasswordChange === true ? null : createdAt
    });

    await writeUsers(usersFilePath, [...users, user]);
    return user;
  };

  const hasPendingCredentialSetup = async () => {
    const users = await readUsers(usersFilePath, legacyUsersFilePath);
    return users.some((entry) => entry.username === 'admin' && !entry.passwordChangedAt);
  };

  const updateAdminCredentials = async ({ email, password }: { email: string, password: string }) => {
    const users = await readUsers(usersFilePath, legacyUsersFilePath);
    const admin = users.find((entry) => entry.username === 'admin');
    if (!admin) {
      throw new Error('Admin user not found');
    }

    const normalizedEmail = `${email ?? ''}`.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await deriveScryptHash(`${password ?? ''}`, salt);
    const passwordChangedAt = now();

    const nextUsers = users.map((entry) => {
      if (entry.id !== admin.id) {
        return entry;
      }

      return Object.freeze({
        ...entry,
        email: normalizedEmail,
        passwordHash,
        passwordChangedAt
      });
    });

    await writeUsers(usersFilePath, nextUsers);
    return nextUsers.find((entry) => entry.id === admin.id) ?? null;
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
    verifyPassword,
    hasPendingCredentialSetup,
    updateAdminCredentials
  });
};
