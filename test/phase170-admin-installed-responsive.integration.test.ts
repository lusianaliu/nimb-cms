import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAdminPagesListPage } from '../core/admin/admin-pages-page.ts';

test('phase 170: admin pages list uses bounded table min-width and mobile main width guardrails', () => {
  const html = renderAdminPagesListPage({
    runtime: { admin: { title: 'Nimb Admin' } },
    pages: [
      {
        id: 'page-1',
        data: {
          title: 'About Our Neighborhood Bakery and Seasonal Menus',
          slug: 'about-our-neighborhood-bakery-and-seasonal-menus',
          status: 'published'
        },
        updatedAt: '2026-03-13T00:00:00.000Z'
      }
    ]
  });

  assert.equal(html.includes('table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; min-width: 520px; }'), true);
  assert.equal(html.includes('table { min-width: 480px; }'), true);
  assert.equal(html.includes('.admin-main { width: 100%; padding: 20px 14px; }'), true);
  assert.equal(html.includes('.admin-main-inner { max-width: 980px; min-width: 0; }'), true);
  assert.equal(html.includes('.table-wrap { width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }'), true);
  assert.equal(html.includes('<div class="table-wrap"><table>'), true);
});
