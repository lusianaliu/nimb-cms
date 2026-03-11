export default function register(api) {
  api.runtime.fieldTypes.register({
    name: 'starter-note',
    validate: (value) => typeof value === 'string',
    serialize: (value) => `${value ?? ''}`,
    deserialize: (value) => `${value ?? ''}`,
    default: ''
  });

  api.runtime.contentTypes.register({
    name: 'Starter Note',
    slug: 'starter-note',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'note', type: 'starter-note' }
    ]
  });

  api.runtime.http.registerRoute('GET', '/plugin/starter-canonical/health', (_request, response) => {
    response.writeHead?.(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end?.(JSON.stringify({ plugin: 'starter-canonical', ok: true }));
  });

  api.runtime.admin.navRegistry.register({
    id: 'starter-canonical',
    label: 'Starter Plugin',
    path: '/admin/plugins/starter-canonical',
    order: 90
  });
}
