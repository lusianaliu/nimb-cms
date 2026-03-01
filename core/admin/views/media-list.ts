const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatSize = (bytes: unknown) => {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value < 1) {
    return '0 B';
  }

  if (value < 1024) {
    return `${Math.round(value)} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const renderMediaList = ({ media }: { media: Array<Record<string, unknown>> }) => {
  const rows = (media ?? []).map((item) => {
    const id = `${item?.id ?? ''}`;
    const safeId = encodeURIComponent(id);

    return `<tr>
      <td><a href="${escapeHtml(`${item?.storagePath ?? '#'}`)}" target="_blank" rel="noreferrer">${escapeHtml(item?.filename)}</a></td>
      <td>${escapeHtml(formatSize(item?.size))}</td>
      <td>${escapeHtml(item?.createdAt)}</td>
      <td>
        <form method="post" action="/admin/media/${safeId}/delete" class="inline-form">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`;
  }).join('\n');

  return `<h1>Media library</h1>
  <p><a href="/admin/media/upload">Upload media</a></p>
  <table>
    <thead>
      <tr><th>Filename</th><th>Size</th><th>Upload date</th><th>Actions</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4">No media uploaded.</td></tr>'}
    </tbody>
  </table>`;
};
