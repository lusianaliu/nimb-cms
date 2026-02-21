/**
 * Architectural intent:
 * The schema is portable and presentation-independent.
 * Body uses block structures so themes remain a separate concern.
 */

export const articleSchema = {
  id: 'content-basic.article',
  version: '1.0.0',
  type: 'object',
  required: ['title', 'body', 'status'],
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      minLength: 1
    },
    body: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: { type: 'string' },
          data: { type: 'object' }
        },
        additionalProperties: true
      }
    },
    status: {
      type: 'string',
      enum: ['draft', 'published']
    }
  }
} as const;
