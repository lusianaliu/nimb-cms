export class AuthService {
  constructor() {
    this.users = new Map();
  }

  register({ username, password }) {
    if (!username || !password) {
      return { ok: false, error: 'Username and password are required' };
    }

    if (this.users.has(username)) {
      return { ok: false, error: 'User already exists' };
    }

    this.users.set(username, { username, password });
    return { ok: true, user: { username } };
  }

  login({ username, password }) {
    if (!username || !password) {
      return { ok: false, error: 'Username and password are required' };
    }

    const user = this.users.get(username);
    if (!user || user.password !== password) {
      return { ok: false, error: 'Invalid credentials' };
    }

    return { ok: true, user: { username: user.username } };
  }
}
