import type { ContentTypeSchema } from '../content-types.ts';

export const media: ContentTypeSchema = Object.freeze({
  name: 'media',
  label: 'Media',
  slug: 'media',
  fields: Object.freeze([
    Object.freeze({ name: 'filename', type: 'string' }),
    Object.freeze({ name: 'path', type: 'string' }),
    Object.freeze({ name: 'mime', type: 'string' }),
    Object.freeze({ name: 'size', type: 'number' }),
    Object.freeze({ name: 'createdAt', type: 'date' })
  ])
});
