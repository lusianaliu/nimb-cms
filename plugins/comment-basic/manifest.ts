/**
 * Architectural intent:
 * This manifest proves a second independent domain can be introduced via public contracts only.
 * It mirrors reference governance metadata used by content-basic without core coupling.
 */

export const pluginManifest = {
  id: '@nimblabs/plugin-comment-basic',
  name: 'Nimb Comment Basic (Reference)',
  version: '0.1.0',
  kind: 'architecture-validation',
  displayName: 'Nimb Comment Basic (Reference)',
  description: 'Validates plugin-owned comment semantics through capability, schema, and lifecycle contracts.',
  entrypoints: {
    register: './register.ts'
  },
  declaredCapabilities: [
    'comment:create',
    'comment:read',
    'comment:update',
    'comment:delete'
  ],
  lifecycleHooks: [
    'onCommentCreate',
    'beforeCommentSave',
    'afterCommentPublish'
  ],
  requiredPlatformContracts: {
    'plugin.registerCapability': '^1.0.0',
    'plugin.unregisterCapability': '^1.0.0',
    'plugin.registerSchema': '^1.0.0',
    'plugin.unregisterSchema': '^1.0.0',
    'plugin.registerLifecycleHook': '^1.0.0'
  }
} as const;

export type CommentBasicManifest = typeof pluginManifest;
