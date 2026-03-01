const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const NAV_ITEMS = Object.freeze([
  { id: 'dashboard', label: 'Dashboard', href: '/admin' },
  { id: 'content', label: 'Content', href: '/admin/content/page' },
  { id: 'posts', label: 'Posts', href: '/admin/content/post' }
]);

export function renderAdminNav(active?: string): string {
  const items = NAV_ITEMS.map((item) => {
    const isActive = item.id === `${active ?? ''}`;
    const activeAttr = isActive ? ' aria-current="page" class="is-active"' : '';

    return `<li><a href="${item.href}"${activeAttr}>${escapeHtml(item.label)}</a></li>`;
  }).join('');

  return `<nav class="admin-nav" aria-label="Admin Navigation"><ul>${items}</ul></nav>`;
}
