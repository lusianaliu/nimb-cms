import { escapeHtml, renderAdminShell } from './admin-shell.ts';
import { listScheduledContentItems } from './scheduled-content.ts';

export const renderAdminScheduledContentPage = ({ runtime }) => {
  const items = listScheduledContentItems(runtime);

  if (items.length === 0) {
    return renderAdminShell({
      title: 'Scheduled Content · Nimb Admin',
      runtime,
      activeNav: 'scheduled',
      pageTitle: 'Scheduled Content',
      pageDescription: 'Review upcoming scheduled pages and posts from one place.',
      content: `<p>No scheduled pages or posts right now. Publish with a future publish date/time to schedule content.</p>
      <p class="muted">You can still use <a href="/admin/pages?filter=scheduled">Pages → Scheduled only</a> and <a href="/admin/posts?filter=scheduled">Posts → Scheduled only</a> for type-specific filtering.</p>`
    });
  }

  const rows = items.map((item) => `<tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.typeLabel)}</td>
      <td><span class="status-pill status-pill--scheduled">Scheduled</span></td>
      <td>${escapeHtml(item.publishTimeLabel)}</td>
      <td><div class="table-actions"><a href="${item.editUrl}">Edit ${escapeHtml(item.typeLabel.toLowerCase())}</a></div></td>
    </tr>`).join('');

  return renderAdminShell({
    title: 'Scheduled Content · Nimb Admin',
    runtime,
    activeNav: 'scheduled',
    pageTitle: 'Scheduled Content',
    pageDescription: 'Review upcoming scheduled pages and posts from one place.',
    content: `<p class="muted">Soonest publish time first. This unified view shows only entries currently in scheduled state.</p>
      <div class="table-wrap"><table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Status</th>
            <th>Publish time</th>
            <th>Quick action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="muted">This screen complements the dashboard overview and does not replace per-type list filters.</p>`
  });
};
