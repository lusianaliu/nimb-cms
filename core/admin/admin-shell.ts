import { renderAdminNav } from './admin-nav.ts';

export type AdminNotice = {
  tone?: 'info' | 'success' | 'warning'
  title?: string
  message: string
};

export type AdminShellContext = {
  title: string
  runtime?: Record<string, unknown>
  activeNav?: string
  pageTitle?: string
  pageDescription?: string
  notice?: AdminNotice | null
  content: string
};

export const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderNotice = (notice?: AdminNotice | null) => {
  if (!notice?.message) {
    return '';
  }

  const tone = notice.tone === 'success' || notice.tone === 'warning' ? notice.tone : 'info';
  const title = notice.title ? `<strong>${escapeHtml(notice.title)}</strong>` : '';
  return `<section class="admin-notice admin-notice--${tone}" role="status" aria-live="polite">${title}<p>${escapeHtml(notice.message)}</p></section>`;
};

export function renderAdminShell(ctx: AdminShellContext): string {
  const appTitle = escapeHtml(`${ctx.runtime?.admin?.title ?? 'Nimb Admin'}`);
  const pageTitle = escapeHtml(ctx.pageTitle ?? ctx.title);
  const pageDescription = `${ctx.pageDescription ?? ''}`.trim();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(ctx.title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; background: #f8fafc; line-height: 1.45; }
    a { color: #1d4ed8; }
    a:hover { color: #1e40af; }
    .admin { min-height: 100vh; display: flex; }
    .admin-sidebar { width: 250px; border-right: 1px solid #e2e8f0; background: #ffffff; padding: 18px 14px; display: grid; gap: 18px; align-content: start; }
    .admin-brand { margin: 0; font-size: 1rem; font-weight: 700; }
    .admin-main { flex: 1; padding: 28px; }
    .admin-main-inner { max-width: 980px; }
    .admin-page-header h1 { margin: 0; font-size: 1.7rem; }
    .admin-page-header p { margin: 8px 0 0; color: #475569; }
    .admin-page-header { margin-bottom: 20px; }
    .admin-surface { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; }
    .admin-content-stack { display: grid; gap: 16px; }
    .admin-nav ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .admin-nav a { display: block; text-decoration: none; color: #1e293b; padding: 8px 10px; border-radius: 8px; font-weight: 500; }
    .admin-nav a:hover, .admin-nav a:focus-visible { background: #e2e8f0; outline: none; }
    .admin-nav a.is-active { background: #0f172a; color: #fff; }
    .admin-logout { margin: 0; }
    .admin-logout button { width: 100%; background: #fff; border: 1px solid #cbd5e1; color: #0f172a; text-align: left; }
    .admin-logout button:hover, .admin-logout button:focus-visible { border-color: #94a3b8; background: #f8fafc; outline: none; }
    .admin-notice { border: 1px solid #cbd5e1; border-left-width: 4px; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; background: #f8fafc; }
    .admin-notice p { margin: 2px 0 0; }
    .admin-notice--success { border-left-color: #16a34a; background: #f0fdf4; }
    .admin-notice--warning { border-left-color: #d97706; background: #fffbeb; }
    .admin-notice--info { border-left-color: #2563eb; background: #eff6ff; }
    .admin-card-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { font-size: 0.92rem; color: #334155; background: #f8fafc; }
    form > div, form > p { margin-bottom: 12px; }
    label { display: inline-block; margin-bottom: 4px; font-weight: 600; }
    input, textarea, select { width: 100%; max-width: 640px; padding: 9px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
    button, .button-link { display: inline-block; background: #0f172a; color: #fff; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.95rem; }
    .button-link--muted { background: #e2e8f0; color: #0f172a; }
    .inline-form { display: inline; margin-left: 8px; }
    .muted { color: #64748b; }
    .field-help { margin: 4px 0 0; color: #64748b; font-size: 0.92rem; }
    .form-grid { display: grid; gap: 12px; }
    .field-error { margin: 4px 0 0; color: #b91c1c; font-size: 0.92rem; }
    .status-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; }
    .status-pill--draft { background: #fff7ed; color: #9a3412; }
    .status-pill--published { background: #ecfdf5; color: #166534; }
    .table-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    @media (max-width: 900px) {
      .admin { flex-direction: column; }
      .admin-sidebar { width: 100%; border-right: 0; border-bottom: 1px solid #e2e8f0; }
      .admin-main { padding: 20px 14px; }
    }
  </style>
</head>
<body>
  <div class="admin">
    <aside class="admin-sidebar">
      <p class="admin-brand">${appTitle}</p>
      ${renderAdminNav(ctx.runtime, ctx.activeNav)}
      <form class="admin-logout" method="post" action="/admin/logout"><button type="submit">Log out</button></form>
    </aside>
    <main class="admin-main">
      <div class="admin-main-inner admin-content-stack">
        <header class="admin-page-header">
          <h1>${pageTitle}</h1>
          ${pageDescription ? `<p>${escapeHtml(pageDescription)}</p>` : ''}
        </header>
        ${renderNotice(ctx.notice)}
        <section class="admin-surface">${ctx.content}</section>
      </div>
    </main>
  </div>
</body>
</html>`;
}
