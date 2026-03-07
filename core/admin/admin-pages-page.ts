const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatDate = (value: unknown) => {
  const input = `${value ?? ''}`.trim();
  if (!input) {
    return '—';
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }

  return date.toISOString();
};

const renderLayout = ({ title, content }: { title: string, content: string }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <header>
      <strong>Nimb CMS Admin</strong>
    </header>
    <aside>
      <nav aria-label="Admin sidebar">
        <ul>
          <li><a href="/admin">Dashboard</a></li>
          <li><a href="/admin/pages">Pages</a></li>
        </ul>
      </nav>
    </aside>
    <main>
      ${content}
    </main>
  </body>
</html>`;

export const renderAdminPagesListPage = ({ pages }) => {
  const rows = (Array.isArray(pages) ? pages : []).map((page) => `<tr>
      <td>${escapeHtml(page?.data?.title)}</td>
      <td>${escapeHtml(page?.data?.slug)}</td>
      <td>${escapeHtml(formatDate(page?.createdAt))}</td>
      <td>
        <a href="/admin/pages/${encodeURIComponent(`${page?.id ?? ''}`)}/edit">Edit</a>
        <form method="post" action="/admin/pages/${encodeURIComponent(`${page?.id ?? ''}`)}/delete" style="display:inline;">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  return renderLayout({
    title: 'Pages · Nimb CMS Admin',
    content: `<h1>Pages</h1>
      <p><a href="/admin/pages/new">Create Page</a></p>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4">No pages found.</td></tr>'}
        </tbody>
      </table>`
  });
};

export const renderAdminPageFormPage = ({ mode, page = null }) => {
  const isEdit = mode === 'edit';
  const id = isEdit ? `${page?.id ?? ''}` : '';
  const action = isEdit
    ? `/admin/pages/${encodeURIComponent(id)}/edit`
    : '/admin/pages/new';

  return renderLayout({
    title: `${isEdit ? 'Edit' : 'Create'} Page · Nimb CMS Admin`,
    content: `<h1>${isEdit ? 'Edit' : 'Create'} Page</h1>
      <form method="post" action="${action}">
        <p>
          <label for="title">Title</label><br>
          <input id="title" name="title" type="text" value="${escapeHtml(page?.data?.title)}" required>
        </p>
        <p>
          <label for="slug">Slug</label><br>
          <input id="slug" name="slug" type="text" value="${escapeHtml(page?.data?.slug)}" required>
        </p>
        <p>
          <label for="body">Body</label><br>
          <textarea id="body" name="body" rows="12">${escapeHtml(page?.data?.body)}</textarea>
        </p>
        <p>
          <button type="submit">${isEdit ? 'Update' : 'Create'} Page</button>
          <a href="/admin/pages">Cancel</a>
        </p>
      </form>
      <script src="/admin/editor/tinymce/tinymce.min.js"></script>
      <script src="/admin/editor/editor.js"></script>
      <script>
        initEditor('#body');
      </script>`
  });
};
