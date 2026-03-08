export function activate(runtime) {
  runtime.hooks.registerHook(
    'admin.page',
    (pages) => {
      pages.register({
        id: 'plugin-tools',
        path: '/admin/plugin-tools',
        title: 'Plugin Tools',
        render: () => `
          <h1>Plugin Tools</h1>
          <p>Hello from plugin.</p>
        `
      });
    }
  );
}
