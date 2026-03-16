import { renderAdminShell, escapeHtml } from './admin-shell.ts';
import { resolvePostPublishState } from '../content/publish-timing.ts';

const normalizeFilter = (value: unknown) => `${value ?? ''}`.trim().toLowerCase() === 'scheduled' ? 'scheduled' : 'all';

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

const statusPill = (post) => {
  const publishState = resolvePostPublishState(post);
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

export const renderAdminPostsListPage = ({ posts, runtime, notice = null, filter = 'all' }) => {
  const activeFilter = normalizeFilter(filter);
  const list = (Array.isArray(posts) ? posts : [])
    .filter((post) => activeFilter === 'scheduled' ? resolvePostPublishState(post).status === 'scheduled' : true);
  const rows = list.map((post) => `<tr>
      <td>${escapeHtml(post?.data?.title || 'Untitled post')}</td>
      <td>${escapeHtml(post?.data?.slug)}</td>
      <td>${statusPill(post)}</td>
      <td>${escapeHtml(formatDate(post?.data?.publishedAt))}</td>
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
      <nav class="filter-tabs" aria-label="Post list filters">
        <a class="filter-tab${activeFilter === 'all' ? ' is-active' : ''}" href="/admin/posts">All posts</a>
        <a class="filter-tab${activeFilter === 'scheduled' ? ' is-active' : ''}" href="/admin/posts?filter=scheduled">Scheduled only</a>
      </nav>
      ${activeFilter === 'scheduled' ? '<p class="muted">Shows posts currently in scheduled state (published with a future publish time).</p>' : ''}
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
      ? '<tr><td colspan="6">No scheduled posts right now. Schedule a post by publishing with a future publish time.</td></tr>'
      : '<tr><td colspan="6">No posts yet. Write a new post to start your blog.</td></tr>')}
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


  const previewLink = isEdit
    ? `/admin/preview/posts/${encodeURIComponent(id)}`
    : '';
  const unsavedPreviewAction = isEdit
    ? `/admin/preview/posts/${encodeURIComponent(id)}/unsaved`
    : '/admin/preview/posts/new/unsaved';

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
            <p class="field-help">Draft posts are hidden. Published posts with a future publish date are scheduled and stay hidden until that time.</p>
          </div>
          <div>
            <label for="publishedAt">Publish date and time (optional)</label>
            <input id="publishedAt" name="publishedAt" type="datetime-local" value="${escapeHtml(mergedValues.publishedAt)}">
            <p class="field-help">Uses your server timezone. If this is in the future and you publish, the post is scheduled and auto-publishes at that time.</p>
          </div>
          <div>
            <label for="body">Post content</label>
            <textarea id="body" name="body" rows="12">${escapeHtml(mergedValues.body)}</textarea>
          </div>
        </div>
        <p class="admin-form-actions">
          <button type="submit" name="workflowAction" value="save-draft">${isEdit ? 'Save draft changes' : 'Save as draft'}</button>
          <button type="submit" name="workflowAction" value="publish-now">${isEdit ? 'Publish changes' : 'Publish now'}</button>
          <button type="submit" formaction="${unsavedPreviewAction}" formmethod="post" formtarget="_blank" formnovalidate>${isEdit ? 'Preview unsaved changes' : 'Preview unsaved post'}</button>
          ${isEdit ? `<a class="button-link button-link--muted" href="${previewLink}" target="_blank" rel="noopener">Preview saved post</a>` : ''}
          <a class="button-link button-link--muted" href="/admin/posts">Cancel</a>
        </p>
        <p class="field-help">${isEdit
    ? 'Preview unsaved changes opens your current editor content in the active theme without saving. Preview saved post opens the latest saved version.'
    : 'Preview unsaved post opens your current draft buffer in the active theme without creating or saving a post.'}</p>
      </form>
      <script src="/admin/editor/tinymce/tinymce.min.js"></script>
      <script src="/admin/editor/editor.js"></script>
      <script>
        initEditor('#body');
      </script>`
  });
};
