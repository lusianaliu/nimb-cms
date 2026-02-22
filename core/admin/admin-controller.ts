import { createApiError, createApiResponse } from '../api/api-controller.ts';

const toCommand = ({ action, requestId, payload = {} }) => Object.freeze({ action, requestId, payload });

export const createAdminController = ({ dispatcher }) => ({
  async restartRuntime({ requestId, payload }) {
    try {
      const execution = await dispatcher.dispatch(toCommand({ action: 'runtime.restart', requestId, payload }));
      return createApiResponse({ data: { command: execution } });
    } catch (error) {
      return createApiError({ code: 'ADMIN_COMMAND_FAILURE', message: error instanceof Error ? error.message : 'Admin restart failed' });
    }
  },

  async persistRuntime({ requestId, payload }) {
    try {
      const execution = await dispatcher.dispatch(toCommand({ action: 'runtime.persist', requestId, payload }));
      return createApiResponse({ data: { command: execution } });
    } catch (error) {
      return createApiError({ code: 'ADMIN_COMMAND_FAILURE', message: error instanceof Error ? error.message : 'Admin persistence failed' });
    }
  },

  async reconcileGoals({ requestId, payload }) {
    try {
      const execution = await dispatcher.dispatch(toCommand({ action: 'goals.reconcile', requestId, payload }));
      return createApiResponse({ data: { command: execution } });
    } catch (error) {
      return createApiError({ code: 'ADMIN_COMMAND_FAILURE', message: error instanceof Error ? error.message : 'Admin reconciliation failed' });
    }
  },

  status() {
    return createApiResponse({ data: { admin: dispatcher.status() } });
  }
});
