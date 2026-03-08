const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

type ContentField = {
  name?: string;
  type?: string;
  required?: boolean;
};

type ContentTypeSchema = {
  fields?: ContentField[];
};

type GenerateAdminFormOptions = {
  action?: string;
  values?: Record<string, unknown>;
  submitLabel?: string;
};

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }

  return `${value ?? ''}`.toLowerCase() === 'true';
};

const renderInput = (field: ContentField, value: unknown) => {
  const fieldName = `${field?.name ?? ''}`;
  const fieldType = `${field?.type ?? 'string'}`;
  const required = field?.required === true ? ' required' : '';

  if (fieldType === 'number') {
    return `<input id="${escapeHtml(fieldName)}" name="${escapeHtml(fieldName)}" type="number" value="${escapeHtml(value)}"${required} />`;
  }

  if (fieldType === 'boolean') {
    const checked = normalizeBoolean(value) ? ' checked' : '';
    return `<input id="${escapeHtml(fieldName)}" name="${escapeHtml(fieldName)}" type="checkbox" value="true"${checked}${required} />`;
  }

  if (fieldType === 'date') {
    const normalized = value instanceof Date ? value.toISOString().slice(0, 10) : `${value ?? ''}`;
    return `<input id="${escapeHtml(fieldName)}" name="${escapeHtml(fieldName)}" type="date" value="${escapeHtml(normalized)}"${required} />`;
  }

  if (fieldType === 'json') {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2);
    return `<textarea id="${escapeHtml(fieldName)}" name="${escapeHtml(fieldName)}" rows="8"${required}>${escapeHtml(serialized)}</textarea>`;
  }

  return `<input id="${escapeHtml(fieldName)}" name="${escapeHtml(fieldName)}" type="text" value="${escapeHtml(value)}"${required} />`;
};

export const generateAdminForm = (contentType: ContentTypeSchema, options: GenerateAdminFormOptions = {}) => {
  const values = options.values ?? {};
  const fields = (contentType?.fields ?? []).map((field) => {
    const name = `${field?.name ?? ''}`;

    return `<div>
      <label for="${escapeHtml(name)}">${escapeHtml(name)}</label>
      ${renderInput(field, values[name])}
    </div>`;
  }).join('\n');

  return `<form method="POST" action="${escapeHtml(options.action ?? '')}">
    ${fields}
    <p><button type="submit">${escapeHtml(options.submitLabel ?? 'Save')}</button></p>
  </form>`;
};
