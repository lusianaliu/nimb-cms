const SYSTEM_SEED_MARKER = Symbol.for('nimb.systemSeed.executed');

const SYSTEM_CONTENT_TYPES = Object.freeze([
  Object.freeze({
    name: 'Page',
    slug: 'page',
    fields: Object.freeze([
      Object.freeze({ name: 'title', type: 'string', required: true }),
      Object.freeze({ name: 'slug', type: 'string', required: true }),
      Object.freeze({ name: 'body', type: 'text' }),
      Object.freeze({ name: 'published', type: 'boolean' })
    ])
  }),
  Object.freeze({
    name: 'Post',
    slug: 'post',
    fields: Object.freeze([
      Object.freeze({ name: 'title', type: 'string', required: true }),
      Object.freeze({ name: 'slug', type: 'string', required: true }),
      Object.freeze({ name: 'body', type: 'text' }),
      Object.freeze({ name: 'published', type: 'boolean' })
    ])
  }),
  Object.freeze({
    name: 'Settings',
    slug: 'settings',
    fields: Object.freeze([
      Object.freeze({ name: 'siteName', type: 'string', required: true }),
      Object.freeze({ name: 'version', type: 'string', required: true }),
      Object.freeze({ name: 'installedAt', type: 'string', required: true })
    ])
  })
]);

const hasSystemMetadata = (runtime) => runtime.contentStore
  .list('settings')
  .some((entry) => {
    const data = entry?.data ?? {};
    return typeof data.siteName === 'string' && typeof data.version === 'string' && typeof data.installedAt === 'string';
  });

export function seedSystem(runtime) {
  if (!runtime || runtime[SYSTEM_SEED_MARKER] === true) {
    return;
  }

  runtime[SYSTEM_SEED_MARKER] = true;

  for (const definition of SYSTEM_CONTENT_TYPES) {
    if (!runtime.contentTypes.get(definition.slug)) {
      runtime.contentTypes.register(definition);
    }
  }

  if (!hasSystemMetadata(runtime)) {
    runtime.contentStore.create('settings', {
      siteName: 'My Nimb Site',
      version: String(runtime.version ?? '0.0.0'),
      installedAt: new Date().toISOString()
    });
  }
}
