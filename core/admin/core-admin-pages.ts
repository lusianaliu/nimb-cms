const toPageHtml = (title: string, description: string) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
</body>
</html>`;

export const registerCoreAdminPages = (runtime) => {
  const pages = [
    {
      id: 'admin-home',
      path: '/admin',
      title: 'Admin',
      description: 'Admin home coming soon.'
    },
    {
      id: 'admin-posts',
      path: '/admin/posts',
      title: 'Posts',
      description: 'Post manager coming soon.'
    },
    {
      id: 'admin-media',
      path: '/admin/media',
      title: 'Media',
      description: 'Media manager coming soon.'
    },
    {
      id: 'admin-pages',
      path: '/admin/pages',
      title: 'Pages',
      description: 'Page manager coming soon.'
    },
    {
      id: 'admin-settings',
      path: '/admin/settings',
      title: 'Settings',
      description: 'Settings manager coming soon.'
    }
  ];

  for (const page of pages) {
    runtime.adminPages.register({
      id: page.id,
      path: page.path,
      title: page.title,
      render: () => toPageHtml(page.title, page.description)
    });
  }
};
