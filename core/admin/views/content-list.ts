const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const toTitle = (entry) => `${entry?.data?.title ?? 'Untitled'}`;
const toSlug = (entry) => `${entry?.data?.slug ?? ''}`;

export const renderContentList = ({ type, entries }) => {
  const rows = entries.map((entry) => {
    const id = `${entry?.id ?? ''}`;
    const safeType = encodeURIComponent(type);
    const safeId = encodeURIComponent(id);

    return `<tr>
      <td>${escapeHtml(toTitle(entry))}</td>
      <td>${escapeHtml(toSlug(entry))}</td>
      <td>${escapeHtml(id)}</td>
      <td>
        <a href="/admin/content/${safeType}/${safeId}/edit">Edit</a>
        <form method="post" action="/admin/content/${safeType}/${safeId}/delete" style="display:inline; margin-left:8px;">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`;
  }).join('\n');

  return `<!doctype html>
<html>
<head>
  <title>${escapeHtml(type)} Content</title>
</head>
<body>
  <h1>${escapeHtml(type)} entries</h1>
  <p><a href="/admin/content/${encodeURIComponent(type)}/new">Create new ${escapeHtml(type)}</a></p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr><th>Title</th><th>Slug</th><th>ID</th><th>Actions</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4">No entries found.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
};
