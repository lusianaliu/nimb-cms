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

const jsonPost = (path, body = {}) => request(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

export const apiClient = Object.freeze({
  clearToken() {
    state.token = null;
  },
  setToken(token) {
    state.token = token;
  },
  async login({ username, password }) {
    return jsonPost('/api/auth/login', { username, password });
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
    return jsonPost('/api/admin/runtime/restart');
  },
  async persistState() {
    return jsonPost('/api/admin/runtime/persist');
  },
  async reconcileGoals() {
    return jsonPost('/api/admin/goals/reconcile');
  },
  async getContentTypes() {
    return request('/api/content-types');
  },
  async createContentType(schema) {
    return jsonPost('/api/admin/content-types', schema);
  },
  async listEntries(type) {
    return request(`/api/entries/${encodeURIComponent(type)}`);
  },
  async getEntry(type, id) {
    return request(`/api/entries/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
  },
  async createEntry(type, data) {
    return jsonPost(`/api/admin/entries/${encodeURIComponent(type)}`, data);
  },
  async publishEntry(type, id) {
    return jsonPost(`/api/admin/entries/${encodeURIComponent(type)}/${encodeURIComponent(id)}/publish`);
  },
  async archiveEntry(type, id) {
    return jsonPost(`/api/admin/entries/${encodeURIComponent(type)}/${encodeURIComponent(id)}/archive`);
  },
  async draftEntry(type, id) {
    return jsonPost(`/api/admin/entries/${encodeURIComponent(type)}/${encodeURIComponent(id)}/draft`);
  }
});
