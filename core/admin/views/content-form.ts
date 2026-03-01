const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }

  return `${value ?? ''}`.toLowerCase() === 'true';
};

const renderFieldInput = (field, value) => {
  const name = `${field?.name ?? ''}`;
  const type = `${field?.type ?? 'string'}`;
  const required = field?.required ? ' required' : '';

  if (type === 'text') {
    return `<textarea id="${escapeHtml(name)}" name="${escapeHtml(name)}"${required} rows="8" cols="60">${escapeHtml(value)}</textarea>`;
  }

  if (type === 'boolean') {
    const checked = normalizeBoolean(value) ? ' checked' : '';
    return `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="checkbox" value="true"${checked} />`;
  }

  if (type === 'number') {
    return `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="number" value="${escapeHtml(value)}"${required} />`;
  }

  if (type === 'datetime') {
    return `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="datetime-local" value="${escapeHtml(value)}"${required} />`;
  }

  return `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="text" value="${escapeHtml(value)}"${required} />`;
};

export const renderContentForm = ({ type, schema, entry, mode }) => {
  const safeType = encodeURIComponent(type);
  const entryData = entry?.data ?? {};
  const action = mode === 'edit'
    ? `/admin/content/${safeType}/${encodeURIComponent(`${entry?.id ?? ''}`)}/update`
    : `/admin/content/${safeType}`;

  const fields = (schema?.fields ?? []).map((field) => {
    const name = `${field?.name ?? ''}`;
    const value = entryData[name] ?? '';

    return `<div>
      <label for="${escapeHtml(name)}">${escapeHtml(name)}</label><br>
      ${renderFieldInput(field, value)}
    </div>`;
  }).join('\n');

  return `<!doctype html>
<html>
<head>
  <title>${mode === 'edit' ? 'Edit' : 'Create'} ${escapeHtml(type)}</title>
</head>
<body>
  <h1>${mode === 'edit' ? 'Edit' : 'Create'} ${escapeHtml(type)}</h1>
  <form method="post" action="${action}">
    ${fields}
    <p>
      <button type="submit">Save</button>
      <a href="/admin/content/${safeType}">Cancel</a>
    </p>
  </form>
</body>
</html>`;
};
