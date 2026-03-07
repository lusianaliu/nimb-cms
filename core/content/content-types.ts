import type { ContentTypeDefinition } from './content-type-registry.ts';
import { ContentTypeRegistry } from './content-type-registry.ts';

export const PAGE_CONTENT_TYPE: ContentTypeDefinition = Object.freeze({
  name: 'Page',
  slug: 'page',
  fields: Object.freeze([
    Object.freeze({ name: 'title', type: 'string', required: true }),
    Object.freeze({ name: 'slug', type: 'string', required: true }),
    Object.freeze({ name: 'body', type: 'text' }),
    Object.freeze({ name: 'published', type: 'boolean' })
  ])
});

export const POST_CONTENT_TYPE: ContentTypeDefinition = Object.freeze({
  name: 'Post',
  slug: 'post',
  fields: Object.freeze([
    Object.freeze({ name: 'title', type: 'string', required: true }),
    Object.freeze({ name: 'slug', type: 'string', required: true }),
    Object.freeze({ name: 'body', type: 'text' }),
    Object.freeze({ name: 'publishedAt', type: 'datetime' }),
    Object.freeze({ name: 'published', type: 'boolean' })
  ])
});

export const SETTINGS_CONTENT_TYPE: ContentTypeDefinition = Object.freeze({
  name: 'Settings',
  slug: 'settings',
  fields: Object.freeze([
    Object.freeze({ name: 'siteName', type: 'string', required: true }),
    Object.freeze({ name: 'version', type: 'string' }),
    Object.freeze({ name: 'installedAt', type: 'string' }),
    Object.freeze({ name: 'adminTheme', type: 'string' }),
    Object.freeze({ name: 'adminTitle', type: 'string' }),
    Object.freeze({ name: 'logoText', type: 'string' }),
    Object.freeze({ name: 'logoUrl', type: 'string' })
  ])
});

export const DEFAULT_CONTENT_TYPES = Object.freeze([
  PAGE_CONTENT_TYPE,
  POST_CONTENT_TYPE,
  SETTINGS_CONTENT_TYPE
]);

export const registerDefaultContentTypes = (registry: ContentTypeRegistry): void => {
  for (const definition of DEFAULT_CONTENT_TYPES) {
    if (!registry.get(definition.slug)) {
      registry.register(definition);
    }
  }
};
