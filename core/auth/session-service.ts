import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const SESSIONS_FILE_PATH = path.resolve('/data/system/sessions.json');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SessionRecord = Readonly<{
  id: string
  userId: string
  createdAt: string
  expiresAt: string
}>;

const ensureParentDirectory = async (filePath: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const parseSessions = (raw: string): SessionRecord[] => {
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
          userId: `${record.userId ?? ''}`,
          createdAt: `${record.createdAt ?? ''}`,
          expiresAt: `${record.expiresAt ?? ''}`
        });
      })
      .filter((entry) => entry.id && entry.userId && entry.createdAt && entry.expiresAt);
  } catch {
    return [];
  }
};

const readSessions = async (): Promise<SessionRecord[]> => {
  try {
    const raw = await fs.readFile(SESSIONS_FILE_PATH, 'utf8');
    return parseSessions(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const writeSessions = async (sessions: SessionRecord[]) => {
  await ensureParentDirectory(SESSIONS_FILE_PATH);
  await fs.writeFile(SESSIONS_FILE_PATH, `${JSON.stringify(sessions, null, 2)}\n`, 'utf8');
};

export const createSessionService = (runtime) => {
  const now = () => runtime?.clock?.() ?? new Date().toISOString();

  const createSession = async (userId: string) => {
    const createdAt = now();
    const expiresAt = new Date(new Date(createdAt).getTime() + SESSION_TTL_MS).toISOString();

    const session = Object.freeze({
      id: crypto.randomUUID(),
      userId: `${userId ?? ''}`,
      createdAt,
      expiresAt
    });

    const sessions = await readSessions();
    await writeSessions([...sessions.filter((entry) => entry.id !== session.id), session]);
    return session;
  };

  const getSession = async (sessionId: string) => {
    const sessions = await readSessions();
    const session = sessions.find((entry) => entry.id === `${sessionId ?? ''}`);

    if (!session) {
      return null;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return session;
  };

  const destroySession = async (sessionId: string) => {
    const sessions = await readSessions();
    const next = sessions.filter((entry) => entry.id !== `${sessionId ?? ''}`);
    await writeSessions(next);
  };

  return Object.freeze({
    createSession,
    getSession,
    destroySession
  });
};
