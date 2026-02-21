/**
 * Architectural intent:
 * Comment capabilities are plugin-owned opaque labels that core treats as domain-agnostic identifiers.
 */

export const commentCapabilities = [
  {
    key: 'comment:create',
    version: '1.0.0',
    description: 'Create comment entities with plugin-defined authoring semantics.'
  },
  {
    key: 'comment:read',
    version: '1.0.0',
    description: 'Read comment entities through plugin-defined query boundaries.'
  },
  {
    key: 'comment:update',
    version: '1.0.0',
    description: 'Update comment entities with plugin-owned validation and moderation policy.'
  },
  {
    key: 'comment:delete',
    version: '1.0.0',
    description: 'Delete comment entities according to plugin-owned retention rules.'
  }
] as const;
