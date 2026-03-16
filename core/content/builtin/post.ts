import type { ContentTypeSchema } from '../content-types.ts';

export const post: ContentTypeSchema = Object.freeze({
  name: 'post',
  label: 'Posts',
  slug: 'post',
  fields: Object.freeze([
    Object.freeze({ name: 'title', type: 'string' }),
    Object.freeze({ name: 'slug', type: 'string' }),
    Object.freeze({ name: 'content', type: 'json' }),
    Object.freeze({ name: 'excerpt', type: 'string' }),
    Object.freeze({ name: 'status', type: 'string' }),
    Object.freeze({ name: 'publishedAt', type: 'date' }),
    Object.freeze({ name: 'createdAt', type: 'date' }),
    Object.freeze({ name: 'updatedAt', type: 'date' })
  ])
});
