export function renderAdminLayout(nav: string, content: string): string {
  return `<div class="admin">
    <aside class="admin-sidebar">${nav}</aside>
    <main class="admin-main">${content}</main>
  </div>`;
}
