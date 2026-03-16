import { renderAdminShell, escapeHtml } from './admin-shell.ts';
import { resolvePagePublishState } from '../content/publish-timing.ts';

const normalizeFilter = (value: unknown) => `${value ?? ''}`.trim().toLowerCase() === 'scheduled' ? 'scheduled' : 'all';

const formatDateTime = (value: unknown) => {
  const input = `${value ?? ''}`.trim();
  if (!input) {
    return '—';
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }

  return date.toISOString().slice(0, 16).replace('T', ' ');
};

const normalizeStatus = (value: unknown) => `${value ?? ''}`.trim().toLowerCase() === 'draft' ? 'draft' : 'published';

const statusPill = (page) => {
  const publishState = resolvePagePublishState(page);
  const label = publishState.status === 'draft'
    ? 'Draft'
    : publishState.status === 'scheduled'
      ? 'Scheduled'
      : 'Published';

  return `<span class="status-pill status-pill--${publishState.status}">${label}</span>`;
};

const toDateTimeLocal = (value: unknown) => {
  const input = `${value ?? ''}`.trim();
  if (!input) {
    return '';
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 16);
};

const toFormStatus = (value: unknown, publishedAt: unknown) => {
  if (`${value ?? ''}`.trim()) {
    return normalizeStatus(value);
  }

  return `${publishedAt ?? ''}`.trim() ? 'published' : 'draft';
};

export const renderAdminPagesListPage = ({ pages, runtime, notice = null, filter = 'all' }) => {
  const activeFilter = normalizeFilter(filter);
  const list = (Array.isArray(pages) ? pages : [])
    .filter((page) => activeFilter === 'scheduled' ? resolvePagePublishState(page).status === 'scheduled' : true);
  const rows = list.map((page) => `<tr>
      <td>${escapeHtml(page?.data?.title || 'Untitled page')}</td>
      <td>${escapeHtml(page?.data?.slug)}</td>
      <td>${statusPill(page)}</td>
      <td>${escapeHtml(formatDateTime(page?.data?.publishedAt))}</td>
      <td>${escapeHtml(formatDateTime(page?.updatedAt ?? page?.createdAt))}</td>
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
      <nav class="filter-tabs" aria-label="Page list filters">
        <a class="filter-tab${activeFilter === 'all' ? ' is-active' : ''}" href="/admin/pages">All pages</a>
        <a class="filter-tab${activeFilter === 'scheduled' ? ' is-active' : ''}" href="/admin/pages?filter=scheduled">Scheduled only</a>
      </nav>
      ${activeFilter === 'scheduled' ? '<p class="muted">Shows pages currently in scheduled state (published with a future publish time).</p>' : ''}
      <div class="table-wrap"><table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Publish time</th>
            <th>Last updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || (activeFilter === 'scheduled'
      ? '<tr><td colspan="6">No scheduled pages right now. Schedule a page by publishing with a future publish time.</td></tr>'
      : '<tr><td colspan="6">No pages yet. Create a new page to build your website navigation.</td></tr>')}
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
    publishedAt: toDateTimeLocal(values.publishedAt ?? page?.data?.publishedAt),
    status: toFormStatus(values.status ?? page?.data?.status, values.publishedAt ?? page?.data?.publishedAt)
  };
  const previewLink = isEdit
    ? `/admin/preview/pages/${encodeURIComponent(id)}`
    : '';
  const unsavedPreviewAction = isEdit
    ? `/admin/preview/pages/${encodeURIComponent(id)}/unsaved`
    : '/admin/preview/pages/new/unsaved';

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
            <label for="status">Publish status</label>
            <select id="status" name="status">
              <option value="published"${mergedValues.status === 'published' ? ' selected' : ''}>Published (visible on website)</option>
              <option value="draft"${mergedValues.status === 'draft' ? ' selected' : ''}>Draft (hidden until published)</option>
            </select>
            <p class="field-help">Draft pages are hidden. Published pages with a future publish date are scheduled and stay hidden until that time.</p>
          </div>
          <div>
            <label for="publishedAt">Publish date and time (optional)</label>
            <input id="publishedAt" name="publishedAt" type="datetime-local" value="${escapeHtml(mergedValues.publishedAt)}">
            <p class="field-help">Uses your server timezone. If this is in the future and you publish, the page is scheduled and auto-publishes at that time.</p>
          </div>
          <div>
            <label for="body">Page content</label>
            <textarea id="body" name="body" rows="12">${escapeHtml(mergedValues.body)}</textarea>
          </div>
        </div>
        <p class="admin-form-actions">
          <button type="submit" name="workflowAction" value="save-draft">${isEdit ? 'Save draft changes' : 'Save as draft'}</button>
          <button type="submit" name="workflowAction" value="publish-now">${isEdit ? 'Publish changes' : 'Publish now'}</button>
          <button type="submit" formaction="${unsavedPreviewAction}" formmethod="post" formtarget="_blank" formnovalidate>${isEdit ? 'Preview unsaved changes' : 'Preview unsaved page'}</button>
          ${isEdit ? `<a class="button-link button-link--muted" href="${previewLink}" target="_blank" rel="noopener">Preview saved page</a>` : ''}
          <a class="button-link button-link--muted" href="/admin/pages">Cancel</a>
        </p>
        <p class="field-help">${isEdit
    ? 'Preview unsaved changes opens your current editor content in the active theme without saving. Preview saved page opens the latest saved version.'
    : 'Preview unsaved page opens your current draft in the active theme before first save.'}
        </p>
      </form>`
  });
};
