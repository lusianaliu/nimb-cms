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

  return date.toISOString().slice(0, 10);
};

const normalizeStatus = (value: unknown) => `${value ?? ''}`.trim().toLowerCase() === 'draft' ? 'draft' : 'published';

const statusPill = (value: unknown) => {
  const status = normalizeStatus(value);
  const label = status === 'draft' ? 'Draft' : 'Published';
  return `<span class="status-pill status-pill--${status}">${label}</span>`;
};

const toFormStatus = (value: unknown) => normalizeStatus(value) === 'draft' ? 'draft' : 'published';

export const renderAdminPagesListPage = ({ pages, runtime, notice = null }) => {
  const rows = (Array.isArray(pages) ? pages : []).map((page) => `<tr>
      <td>${escapeHtml(page?.data?.title || 'Untitled page')}</td>
      <td>${escapeHtml(page?.data?.slug)}</td>
      <td>${statusPill(page?.data?.status)}</td>
      <td>${escapeHtml(formatDate(page?.updatedAt ?? page?.createdAt))}</td>
      <td>
        <div class="table-actions">
          <a href="/admin/pages/${encodeURIComponent(`${page?.id ?? ''}`)}/edit">Edit</a>
          <form method="post" action="/admin/pages/${encodeURIComponent(`${page?.id ?? ''}`)}/delete" class="inline-form">
            <button type="submit">Delete</button>
          </form>
        </div>
      </td>
    </tr>`).join('');

  return renderAdminShell({
    title: 'Pages · Nimb CMS Admin',
    runtime,
    activeNav: 'pages',
    pageTitle: 'Pages',
    pageDescription: 'Pages are for your main website sections like Home, About, Services, or Contact.',
    notice,
    content: `<p><a class="button-link" href="/admin/pages/new">Create a new page</a></p>
      <div class="table-wrap"><table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Last updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5">No pages yet. Create a new page to build your website navigation.</td></tr>'}
        </tbody>
      </table></div>`
  });
};

export const renderAdminPageFormPage = ({ mode, page = null, runtime, notice = null, values = {}, errors = [] }) => {
  const isEdit = mode === 'edit';
  const id = isEdit ? `${page?.id ?? ''}` : '';
  const action = isEdit
    ? `/admin/pages/${encodeURIComponent(id)}/edit`
    : '/admin/pages/new';
  const mergedValues = {
    title: `${values.title ?? page?.data?.title ?? ''}`,
    slug: `${values.slug ?? page?.data?.slug ?? ''}`,
    body: `${values.body ?? page?.data?.body ?? page?.data?.content ?? ''}`,
    status: toFormStatus(values.status ?? page?.data?.status)
  };

  const errorNotice = errors.length > 0
    ? {
      tone: 'warning' as const,
      title: 'Please check the form',
      message: errors.join(' ')
    }
    : notice;

  return renderAdminShell({
    title: `${isEdit ? 'Edit' : 'Create'} Page · Nimb CMS Admin`,
    runtime,
    activeNav: 'pages',
    pageTitle: `${isEdit ? 'Edit' : 'Create'} Page`,
    pageDescription: 'Pages are best for long-lived website content. Use posts for news or article updates.',
    notice: errorNotice,
    content: `<form method="post" action="${action}">
        <div class="form-grid">
          <div>
            <label for="title">Page title</label>
            <input id="title" name="title" type="text" value="${escapeHtml(mergedValues.title)}" required>
            <p class="field-help">This title is shown in menus and page headings.</p>
          </div>
          <div>
            <label for="slug">Page URL slug</label>
            <input id="slug" name="slug" type="text" value="${escapeHtml(mergedValues.slug)}" required>
            <p class="field-help">Used in the page URL, for example <code>/about-us</code>. Leave simple words with hyphens.</p>
          </div>
          <div>
            <label for="status">Visibility</label>
            <select id="status" name="status">
              <option value="published"${mergedValues.status === 'published' ? ' selected' : ''}>Published (visible on website)</option>
              <option value="draft"${mergedValues.status === 'draft' ? ' selected' : ''}>Draft (hidden until published)</option>
            </select>
          </div>
          <div>
            <label for="body">Page content</label>
            <textarea id="body" name="body" rows="12">${escapeHtml(mergedValues.body)}</textarea>
          </div>
        </div>
        <p class="admin-form-actions">
          <button type="submit">${mergedValues.status === 'published' ? (isEdit ? 'Save changes' : 'Create and publish') : (isEdit ? 'Save draft changes' : 'Create draft')}</button>
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
