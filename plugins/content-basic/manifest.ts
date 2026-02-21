/**
 * Architectural intent:
 * This manifest is an explicit contract declaration for a reference plugin.
 * It validates extension boundaries without adding product features.
 */

export const pluginManifest = {
  id: '@nimblabs/plugin-content-basic',
  version: '0.1.0',
  kind: 'architecture-validation',
  displayName: 'Nimb Content Basic (Reference)',
  description: 'Validates capability, schema, and lifecycle extension contracts for content workflows.',
  entrypoints: {
    register: './register.ts'
  },
  declaredCapabilities: [
    'content:create',
    'content:read',
    'content:update',
    'content:delete'
  ],
  exportedCapabilities: {
    'content:create': () => ({
      create: async (payload: { title?: string } = {}) => ({
        status: 'created',
        title: payload.title ?? 'untitled'
      })
    })
  },
  lifecycleHooks: [
    'onContentCreate',
    'beforeContentSave',
    'afterContentPublish'
  ],
  requiredPlatformContracts: {
    'plugin.registerCapability': '^1.0.0',
    'plugin.unregisterCapability': '^1.0.0',
    'plugin.registerSchema': '^1.0.0',
    'plugin.unregisterSchema': '^1.0.0',
    'plugin.registerLifecycleHook': '^1.0.0'
  }
} as const;

export type ContentBasicManifest = typeof pluginManifest;
