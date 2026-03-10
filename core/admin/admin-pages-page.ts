import { renderAdminShell, escapeHtml } from './admin-shell.ts';

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

export const renderAdminPagesListPage = ({ pages, runtime }) => {
  const rows = (Array.isArray(pages) ? pages : []).map((page) => `<tr>
      <td>${escapeHtml(page?.data?.title)}</td>
      <td>${escapeHtml(page?.data?.slug)}</td>
      <td>${escapeHtml(formatDate(page?.createdAt))}</td>
      <td>
        <a href="/admin/pages/${encodeURIComponent(`${page?.id ?? ''}`)}/edit">Edit</a>
        <form method="post" action="/admin/pages/${encodeURIComponent(`${page?.id ?? ''}`)}/delete" class="inline-form">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  return renderAdminShell({
    title: 'Pages · Nimb CMS Admin',
    runtime,
    activeNav: 'pages',
    pageTitle: 'Pages',
    pageDescription: 'Create and maintain your website pages.',
    content: `<p><a class="button-link" href="/admin/pages/new">Create page</a></p>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4">No pages yet. Create your first page to get started.</td></tr>'}
        </tbody>
      </table>`
  });
};

export const renderAdminPageFormPage = ({ mode, page = null, runtime }) => {
  const isEdit = mode === 'edit';
  const id = isEdit ? `${page?.id ?? ''}` : '';
  const action = isEdit
    ? `/admin/pages/${encodeURIComponent(id)}/edit`
    : '/admin/pages/new';

  return renderAdminShell({
    title: `${isEdit ? 'Edit' : 'Create'} Page · Nimb CMS Admin`,
    runtime,
    activeNav: 'pages',
    pageTitle: `${isEdit ? 'Edit' : 'Create'} Page`,
    content: `<form method="post" action="${action}">
        <div>
          <label for="title">Title</label>
          <input id="title" name="title" type="text" value="${escapeHtml(page?.data?.title)}" required>
        </div>
        <div>
          <label for="slug">Slug</label>
          <input id="slug" name="slug" type="text" value="${escapeHtml(page?.data?.slug)}" required>
        </div>
        <div>
          <label for="body">Body</label>
          <textarea id="body" name="body" rows="12">${escapeHtml(page?.data?.body)}</textarea>
        </div>
        <p>
          <button type="submit">${isEdit ? 'Update' : 'Create'} page</button>
          <a class="button-link button-link--muted" href="/admin/pages">Cancel</a>
        </p>
      </form>
      <script src="/admin/editor/tinymce/tinymce.min.js"></script>
      <script src="/admin/editor/editor.js"></script>
      <script>
        initEditor('#body');
      </script>`
  });
};
