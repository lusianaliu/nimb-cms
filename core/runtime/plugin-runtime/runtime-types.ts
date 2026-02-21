export const PluginState = Object.freeze({
  DISCOVERED: 'discovered',
  VALIDATED: 'validated',
  ACTIVE: 'active',
  FAILED: 'failed'
});

export const RuntimeEvent = Object.freeze({
  DISCOVER: 'plugin.runtime.discover',
  VALIDATE: 'plugin.runtime.validate',
  REGISTER: 'plugin.runtime.register',
  ACTIVATE: 'plugin.runtime.activate',
  UNLOAD: 'plugin.runtime.unload',
  FAILURE: 'plugin.runtime.failure'
});

export const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const createStructuredError = (error) => ({
  message: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined
});
