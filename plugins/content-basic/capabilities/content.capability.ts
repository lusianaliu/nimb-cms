/**
 * Architectural intent:
 * Capabilities are opaque labels owned by the plugin.
 * The core should register/unregister them without understanding content semantics.
 */

export const contentCapabilities = [
  {
    key: 'content:create',
    version: '1.0.0',
    description: 'Create content entities via plugin-defined workflow.'
  },
  {
    key: 'content:read',
    version: '1.0.0',
    description: 'Read content entities via plugin-defined query contract.'
  },
  {
    key: 'content:update',
    version: '1.0.0',
    description: 'Update content entities with plugin-owned validation rules.'
  },
  {
    key: 'content:delete',
    version: '1.0.0',
    description: 'Delete content entities according to plugin-owned policy.'
  }
] as const;
