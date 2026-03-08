import type { ContentTypeSchema } from '../content-types.ts';

export const page: ContentTypeSchema = Object.freeze({
  name: 'page',
  label: 'Pages',
  slug: 'page',
  fields: Object.freeze([
    Object.freeze({ name: 'title', type: 'string' }),
    Object.freeze({ name: 'slug', type: 'string' }),
    Object.freeze({ name: 'content', type: 'json' }),
    Object.freeze({ name: 'status', type: 'string' }),
    Object.freeze({ name: 'createdAt', type: 'date' }),
    Object.freeze({ name: 'updatedAt', type: 'date' })
  ])
});
