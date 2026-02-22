const state = {
  token: null
};

const request = async (path, options = {}) => {
  const headers = {
    ...(options.headers ?? {})
  };

  if (state.token) {
    headers.authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const payload = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    payload
  };
};

export const apiClient = Object.freeze({
  clearToken() {
    state.token = null;
  },
  setToken(token) {
    state.token = token;
  },
  async login({ username, password }) {
    return request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  },
  async getSystem() {
    return request('/api/system');
  },
  async getRuntime() {
    return request('/api/runtime');
  },
  async getAdminStatus() {
    return request('/api/admin/status');
  },
  async restartRuntime() {
    return request('/api/admin/runtime/restart', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
  },
  async persistState() {
    return request('/api/admin/runtime/persist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
  },
  async reconcileGoals() {
    return request('/api/admin/goals/reconcile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
  }
});
