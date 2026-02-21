import crypto from 'node:crypto';

export class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  create(subject) {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date().toISOString(),
      subject
    });
    return sessionId;
  }

  get(sessionId) {
    if (!sessionId) {
      return null;
    }

    return this.sessions.get(sessionId) ?? null;
  }

  delete(sessionId) {
    if (!sessionId) {
      return false;
    }

    return this.sessions.delete(sessionId);
  }
}
