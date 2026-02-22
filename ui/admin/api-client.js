const state = {
  token: null
};

const apiPath = (resource) => `/api${resource.startsWith('/') ? resource : `/${resource}`}`;

const request = async (resource, options = {}) => {
  const headers = {
    ...(options.headers ?? {})
  };

  if (state.token) {
    headers.authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(apiPath(resource), {
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
    return jsonPost('/auth/login', { username, password });
  },
  async getSystem() {
    return request('/system');
  },
  async getRuntime() {
    return request('/runtime');
  },
  async getAdminStatus() {
    return request('/admin/status');
  },
  async restartRuntime() {
    return jsonPost('/admin/runtime/restart');
  },
  async persistState() {
    return jsonPost('/admin/runtime/persist');
  },
  async reconcileGoals() {
    return jsonPost('/admin/goals/reconcile');
  },
  async getContentTypes() {
    return request('/content-types');
  },
  async createContentType(schema) {
    return jsonPost('/admin/content-types', schema);
  },
  async listEntries(type) {
    return request(`/entries/${encodeURIComponent(type)}`);
  },
  async getEntry(type, id) {
    return request(`/entries/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
  },
  async createEntry(type, data) {
    return jsonPost(`/admin/entries/${encodeURIComponent(type)}`, data);
  },
  async publishEntry(type, id) {
    return jsonPost(`/admin/entries/${encodeURIComponent(type)}/${encodeURIComponent(id)}/publish`);
  },
  async archiveEntry(type, id) {
    return jsonPost(`/admin/entries/${encodeURIComponent(type)}/${encodeURIComponent(id)}/archive`);
  },
  async draftEntry(type, id) {
    return jsonPost(`/admin/entries/${encodeURIComponent(type)}/${encodeURIComponent(id)}/draft`);
  }
});
