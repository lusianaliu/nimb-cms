import { renderAdminLayout } from './admin-layout.ts';
import { renderAdminNav } from './admin-nav.ts';

export type AdminShellContext = {
  title: string
  activeNav?: string
  content: string
};

const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export function renderAdminShell(ctx: AdminShellContext): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(ctx.title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; background: #f8fafc; }
    .admin { min-height: 100vh; display: flex; }
    .admin-sidebar { width: 240px; border-right: 1px solid #e2e8f0; background: #ffffff; padding: 16px 12px; }
    .admin-main { flex: 1; padding: 24px; }
    .admin-nav ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .admin-nav a { display: block; text-decoration: none; color: #1e293b; padding: 8px 10px; border-radius: 8px; }
    .admin-nav a:hover { background: #e2e8f0; }
    .admin-nav a.is-active { background: #0f172a; color: #ffffff; }
    h1 { margin-top: 0; font-size: 1.5rem; }
    table { width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    form > div { margin-bottom: 12px; }
    label { display: inline-block; margin-bottom: 4px; font-weight: 600; }
    input, textarea { width: 100%; max-width: 640px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
    button { background: #0f172a; color: #ffffff; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
    button:hover { opacity: 0.92; }
    a { color: #1d4ed8; }
    .inline-form { display: inline; margin-left: 8px; }
    @media (max-width: 900px) {
      .admin { flex-direction: column; }
      .admin-sidebar { width: 100%; border-right: 0; border-bottom: 1px solid #e2e8f0; }
    }
  </style>
</head>
<body>
  ${renderAdminLayout(renderAdminNav(ctx.activeNav), ctx.content)}
</body>
</html>`;
}
