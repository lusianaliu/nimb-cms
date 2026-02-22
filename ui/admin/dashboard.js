import { apiClient } from './api-client.js';

const sessionStatus = document.querySelector('#session-status');
const runtimeOutput = document.querySelector('#runtime-output');
const systemOutput = document.querySelector('#system-output');
const adminOutput = document.querySelector('#admin-output');
const actionStatus = document.querySelector('#action-status');

const restartButton = document.querySelector('#restart-runtime');
const persistButton = document.querySelector('#persist-state');
const reconcileButton = document.querySelector('#reconcile-goals');

const toDeterministicJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const setText = (element, text) => {
  if (element) {
    element.textContent = text;
  }
};

const refreshDashboard = async () => {
  const [systemResult, runtimeResult, adminResult] = await Promise.all([
    apiClient.getSystem(),
    apiClient.getRuntime(),
    apiClient.getAdminStatus()
  ]);

  if (!adminResult.ok) {
    setText(sessionStatus, 'Auth status: unauthorized');
    setText(adminOutput, toDeterministicJson(adminResult.payload));
    return;
  }

  setText(sessionStatus, 'Auth status: authenticated');
  setText(systemOutput, toDeterministicJson(systemResult.payload));
  setText(runtimeOutput, toDeterministicJson(runtimeResult.payload));
  setText(adminOutput, toDeterministicJson(adminResult.payload));
};

const runAction = async (action, label) => {
  const result = await action();
  setText(actionStatus, `${label}: ${result.status}`);
  await refreshDashboard();
};

restartButton?.addEventListener('click', () => runAction(() => apiClient.restartRuntime(), 'Restart Runtime'));
persistButton?.addEventListener('click', () => runAction(() => apiClient.persistState(), 'Persist State'));
reconcileButton?.addEventListener('click', () => runAction(() => apiClient.reconcileGoals(), 'Reconcile Goals'));

window.addEventListener('nimb:auth-ready', () => {
  refreshDashboard();
});
