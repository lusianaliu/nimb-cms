const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const hasCapability = (runtime, capability: string) => {
  const checker = runtime?.auth?.hasCapability;
  if (typeof checker !== 'function') {
    return true;
  }

  return checker(capability) !== false;
};

export function renderAdminNav(runtime, active?: string): string {
  const navItems = (runtime?.admin?.navRegistry?.list?.() ?? []).filter((item) => {
    const capability = `${item?.capability ?? ''}`.trim();
    if (!capability) {
      return true;
    }

    return hasCapability(runtime, capability);
  }).map((item) => {
    const isActive = item.id === `${active ?? ''}`;
    const activeAttr = isActive ? ' aria-current="page" class="is-active"' : '';

    return `<li><a href="${escapeHtml(item.path)}"${activeAttr}>${escapeHtml(item.label)}</a></li>`;
  }).join('');

  const pluginItems = (runtime?.adminMenu?.list?.() ?? []).map((item) => {
    return `<li><a href="${escapeHtml(item.path)}"><span aria-hidden="true">${escapeHtml(item.icon)}</span> ${escapeHtml(item.title)}</a></li>`;
  }).join('');

  return `<nav class="admin-nav" aria-label="Admin Navigation"><ul>${navItems}${pluginItems}</ul></nav>`;
}
