import { deterministicJson } from '../persistence/persistence-snapshot.ts';

const AUTH_STORAGE_KEY = 'auth';

const freezeEntries = <T>(entries: T[]) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

const normalizeSnapshot = (snapshot: Record<string, unknown> | null) => {
  const users = Array.isArray(snapshot?.users) ? snapshot.users : [];
  const sessions = Array.isArray(snapshot?.sessions) ? snapshot.sessions : [];

  const orderedUsers = [...users]
    .map((user) => ({ ...(user as Record<string, unknown>) }))
    .sort((left, right) => String(left.id ?? '').localeCompare(String(right.id ?? '')));
  const orderedSessions = [...sessions]
    .map((session) => ({ ...(session as Record<string, unknown>) }))
    .sort((left, right) => String(left.token ?? '').localeCompare(String(right.token ?? '')));

  return Object.freeze({
    users: freezeEntries(orderedUsers),
    sessions: freezeEntries(orderedSessions)
  });
};

export class SessionStore {
  storageAdapter: { read: (key: string) => Promise<Record<string, unknown> | null>, write: (key: string, value: unknown) => Promise<unknown> };
  lastSerialized: string | null;
  state: Readonly<{ users: ReadonlyArray<Record<string, unknown>>, sessions: ReadonlyArray<Record<string, unknown>> }>;

  constructor({ storageAdapter }: { storageAdapter: { read: (key: string) => Promise<Record<string, unknown> | null>, write: (key: string, value: unknown) => Promise<unknown> } }) {
    this.storageAdapter = storageAdapter;
    this.lastSerialized = null;
    this.state = normalizeSnapshot(null);
  }

  async restore() {
    const existing = await this.storageAdapter.read(AUTH_STORAGE_KEY);
    this.state = normalizeSnapshot(existing?.payload as Record<string, unknown> | null);
    this.lastSerialized = deterministicJson(this.state);
    return this.snapshot();
  }

  snapshot() {
    return this.state;
  }

  async save(nextState: { users: Record<string, unknown>[], sessions: Record<string, unknown>[] }) {
    this.state = normalizeSnapshot(nextState);
    const serialized = deterministicJson(this.state);

    if (serialized === this.lastSerialized) {
      return this.snapshot();
    }

    await this.storageAdapter.write(AUTH_STORAGE_KEY, {
      schemaVersion: 'v1',
      payload: this.state
    });
    this.lastSerialized = serialized;
    return this.snapshot();
  }
}
