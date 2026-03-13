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

  return date.toISOString().slice(0, 16).replace('T', ' ');
};

const normalizeStatus = (value: unknown) => `${value ?? ''}`.trim().toLowerCase() === 'draft' ? 'draft' : 'published';

const statusPill = (value: unknown) => {
  const status = normalizeStatus(value);
  const label = status === 'draft' ? 'Draft' : 'Published';
  return `<span class="status-pill status-pill--${status}">${label}</span>`;
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

export const renderAdminPostsListPage = ({ posts, runtime, notice = null }) => {
  const rows = (Array.isArray(posts) ? posts : []).map((post) => `<tr>
      <td>${escapeHtml(post?.data?.title || 'Untitled post')}</td>
      <td>${escapeHtml(post?.data?.slug)}</td>
      <td>${statusPill(post?.data?.status ?? (post?.data?.publishedAt ? 'published' : 'draft'))}</td>
      <td>${escapeHtml(formatDate(post?.updatedAt ?? post?.createdAt))}</td>
      <td>
        <div class="table-actions">
          <a href="/admin/posts/${encodeURIComponent(`${post?.id ?? ''}`)}/edit">Edit</a>
          <form method="post" action="/admin/posts/${encodeURIComponent(`${post?.id ?? ''}`)}/delete" class="inline-form">
            <button type="submit">Delete</button>
          </form>
        </div>
      </td>
    </tr>`).join('');

  return renderAdminShell({
    title: 'Posts · Nimb CMS Admin',
    runtime,
    activeNav: 'posts',
    pageTitle: 'Posts',
    pageDescription: 'Posts are for blog updates, news, and time-based content.',
    notice,
    content: `<p><a class="button-link" href="/admin/posts/new">Write a new post</a></p>
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
          ${rows || '<tr><td colspan="5">No posts yet. Write a new post to start your blog.</td></tr>'}
        </tbody>
      </table></div>`
  });
};

export const renderAdminPostFormPage = ({ mode, post = null, runtime, notice = null, values = {}, errors = [] }) => {
  const isEdit = mode === 'edit';
  const id = isEdit ? `${post?.id ?? ''}` : '';
  const action = isEdit
    ? `/admin/posts/${encodeURIComponent(id)}/edit`
    : '/admin/posts/new';

  const mergedValues = {
    title: `${values.title ?? post?.data?.title ?? ''}`,
    slug: `${values.slug ?? post?.data?.slug ?? ''}`,
    body: `${values.body ?? post?.data?.body ?? post?.data?.content ?? ''}`,
    publishedAt: toDateTimeLocal(values.publishedAt ?? post?.data?.publishedAt),
    status: toFormStatus(values.status ?? post?.data?.status, values.publishedAt ?? post?.data?.publishedAt)
  };

  const errorNotice = errors.length > 0
    ? {
      tone: 'warning' as const,
      title: 'Please check the form',
      message: errors.join(' ')
    }
    : notice;

  return renderAdminShell({
    title: `${isEdit ? 'Edit' : 'Create'} Post · Nimb CMS Admin`,
    runtime,
    activeNav: 'posts',
    pageTitle: `${isEdit ? 'Edit' : 'Create'} Post`,
    pageDescription: 'Posts are for articles and updates. Use pages for long-lived website sections.',
    notice: errorNotice,
    content: `<form method="post" action="${action}">
        <div class="form-grid">
          <div>
            <label for="title">Post title</label>
            <input id="title" name="title" type="text" value="${escapeHtml(mergedValues.title)}" required>
            <p class="field-help">This appears as the article headline.</p>
          </div>
          <div>
            <label for="slug">Post URL slug</label>
            <input id="slug" name="slug" type="text" value="${escapeHtml(mergedValues.slug)}" required>
            <p class="field-help">Used in the URL, for example <code>/blog/my-update</code>.</p>
          </div>
          <div>
            <label for="status">Publish status</label>
            <select id="status" name="status">
              <option value="published"${mergedValues.status === 'published' ? ' selected' : ''}>Published (visible on blog)</option>
              <option value="draft"${mergedValues.status === 'draft' ? ' selected' : ''}>Draft (hidden until published)</option>
            </select>
            <p class="field-help">Draft posts are saved but not shown on your public blog.</p>
          </div>
          <div>
            <label for="publishedAt">Publish date and time (optional)</label>
            <input id="publishedAt" name="publishedAt" type="datetime-local" value="${escapeHtml(mergedValues.publishedAt)}">
            <p class="field-help">Optional. If empty, the post uses the latest update time for ordering.</p>
          </div>
          <div>
            <label for="body">Post content</label>
            <textarea id="body" name="body" rows="12">${escapeHtml(mergedValues.body)}</textarea>
          </div>
        </div>
        <p class="admin-form-actions">
          <button type="submit">${mergedValues.status === 'published' ? (isEdit ? 'Update published post' : 'Publish post') : (isEdit ? 'Save draft changes' : 'Save draft')}</button>
          <a class="button-link button-link--muted" href="/admin/posts">Cancel</a>
        </p>
      </form>
      <script src="/admin/editor/tinymce/tinymce.min.js"></script>
      <script src="/admin/editor/editor.js"></script>
      <script>
        initEditor('#body');
      </script>`
  });
};
