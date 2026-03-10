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

export const renderAdminPostsListPage = ({ posts, runtime }) => {
  const rows = (Array.isArray(posts) ? posts : []).map((post) => `<tr>
      <td>${escapeHtml(post?.data?.title)}</td>
      <td>${escapeHtml(post?.data?.slug)}</td>
      <td>${escapeHtml(formatDate(post?.data?.publishedAt))}</td>
      <td>
        <a href="/admin/posts/${encodeURIComponent(`${post?.id ?? ''}`)}/edit">Edit</a>
        <form method="post" action="/admin/posts/${encodeURIComponent(`${post?.id ?? ''}`)}/delete" class="inline-form">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  return renderAdminShell({
    title: 'Posts · Nimb CMS Admin',
    runtime,
    activeNav: 'posts',
    pageTitle: 'Posts',
    pageDescription: 'Manage blog posts and publishing dates.',
    content: `<p><a class="button-link" href="/admin/posts/new">Create post</a></p>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Published</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4">No posts yet. Write your first post to begin.</td></tr>'}
        </tbody>
      </table>`
  });
};

export const renderAdminPostFormPage = ({ mode, post = null, runtime }) => {
  const isEdit = mode === 'edit';
  const id = isEdit ? `${post?.id ?? ''}` : '';
  const action = isEdit
    ? `/admin/posts/${encodeURIComponent(id)}/edit`
    : '/admin/posts/new';

  return renderAdminShell({
    title: `${isEdit ? 'Edit' : 'Create'} Post · Nimb CMS Admin`,
    runtime,
    activeNav: 'posts',
    pageTitle: `${isEdit ? 'Edit' : 'Create'} Post`,
    content: `<form method="post" action="${action}">
        <div>
          <label for="title">Title</label>
          <input id="title" name="title" type="text" value="${escapeHtml(post?.data?.title)}" required>
        </div>
        <div>
          <label for="slug">Slug</label>
          <input id="slug" name="slug" type="text" value="${escapeHtml(post?.data?.slug)}" required>
        </div>
        <div>
          <label for="body">Body</label>
          <textarea id="body" name="body" rows="12">${escapeHtml(post?.data?.body)}</textarea>
        </div>
        <div>
          <label for="publishedAt">Publish date</label>
          <input id="publishedAt" name="publishedAt" type="datetime-local" value="${escapeHtml(post?.data?.publishedAt)}">
        </div>
        <p>
          <button type="submit">${isEdit ? 'Update' : 'Create'} post</button>
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
