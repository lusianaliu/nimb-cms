/**
 * Architectural intent:
 * The comment schema is portable and presentation-independent.
 * It captures comment-domain content structure without theme or UI assumptions.
 */

export const commentSchema = {
  id: 'comment-basic.comment',
  version: '1.0.0',
  type: 'object',
  required: ['id', 'content', 'author', 'createdAt', 'status'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    content: {
      type: 'string',
      minLength: 1
    },
    author: {
      type: 'string',
      minLength: 1
    },
    createdAt: {
      type: 'string',
      format: 'date-time'
    },
    status: {
      type: 'string',
      enum: ['pending', 'approved', 'rejected']
    }
  }
} as const;
