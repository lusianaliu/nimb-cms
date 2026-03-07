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
          <li><a href="/admin/posts">Posts</a></li>
        </ul>
      </nav>
    </aside>
    <main>
      ${content}
    </main>
  </body>
</html>`;

export const renderAdminPostsListPage = ({ posts }) => {
  const rows = (Array.isArray(posts) ? posts : []).map((post) => `<tr>
      <td>${escapeHtml(post?.data?.title)}</td>
      <td>${escapeHtml(post?.data?.slug)}</td>
      <td>${escapeHtml(formatDate(post?.data?.publishedAt))}</td>
      <td>
        <a href="/admin/posts/${encodeURIComponent(`${post?.id ?? ''}`)}/edit">Edit</a>
        <form method="post" action="/admin/posts/${encodeURIComponent(`${post?.id ?? ''}`)}/delete" style="display:inline;">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  return renderLayout({
    title: 'Posts · Nimb CMS Admin',
    content: `<h1>Posts</h1>
      <p><a href="/admin/posts/new">Create Post</a></p>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Published At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4">No posts found.</td></tr>'}
        </tbody>
      </table>`
  });
};

export const renderAdminPostFormPage = ({ mode, post = null }) => {
  const isEdit = mode === 'edit';
  const id = isEdit ? `${post?.id ?? ''}` : '';
  const action = isEdit
    ? `/admin/posts/${encodeURIComponent(id)}/edit`
    : '/admin/posts/new';

  return renderLayout({
    title: `${isEdit ? 'Edit' : 'Create'} Post · Nimb CMS Admin`,
    content: `<h1>${isEdit ? 'Edit' : 'Create'} Post</h1>
      <form method="post" action="${action}">
        <p>
          <label for="title">Title</label><br>
          <input id="title" name="title" type="text" value="${escapeHtml(post?.data?.title)}" required>
        </p>
        <p>
          <label for="slug">Slug</label><br>
          <input id="slug" name="slug" type="text" value="${escapeHtml(post?.data?.slug)}" required>
        </p>
        <p>
          <label for="body">Body</label><br>
          <textarea id="body" name="body" rows="12">${escapeHtml(post?.data?.body)}</textarea>
        </p>
        <p>
          <label for="publishedAt">Published At</label><br>
          <input id="publishedAt" name="publishedAt" type="datetime-local" value="${escapeHtml(post?.data?.publishedAt)}">
        </p>
        <p>
          <button type="submit">${isEdit ? 'Update' : 'Create'} Post</button>
          <a href="/admin/posts">Cancel</a>
        </p>
      </form>`
  });
};
