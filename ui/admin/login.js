import { apiClient } from './api-client.js';

const loginPanel = document.querySelector('#login-panel');
const dashboardPanel = document.querySelector('#dashboard-panel');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');

const setLoginMessage = (message) => {
  loginStatus.textContent = message;
};

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const username = `${formData.get('username') ?? ''}`;
  const password = `${formData.get('password') ?? ''}`;

  const result = await apiClient.login({ username, password });

  if (!result.ok || !result.payload?.success) {
    apiClient.clearToken();
    setLoginMessage('Login failed.');
    return;
  }

  const token = result.payload?.data?.session?.token;
  if (typeof token !== 'string' || token.length === 0) {
    apiClient.clearToken();
    setLoginMessage('Login failed.');
    return;
  }

  apiClient.setToken(token);
  setLoginMessage('Authenticated.');
  loginPanel?.classList.add('hidden');
  dashboardPanel?.classList.remove('hidden');
  window.dispatchEvent(new Event('nimb:auth-ready'));
});
