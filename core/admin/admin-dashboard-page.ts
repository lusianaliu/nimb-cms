import { loadSystemConfig } from '../system/system-config.ts';
import { escapeHtml, renderAdminShell } from './admin-shell.ts';
import { resolvePagePublishState, resolvePostPublishState } from '../content/publish-timing.ts';

type DashboardOptions = {
  welcome?: boolean
};

type ScheduledQueueItem = {
  id: string
  title: string
  typeLabel: 'Page' | 'Post'
  publishTimeLabel: string
  editUrl: string
  publishedAtMs: number
};

const formatScheduledTime = (value: unknown) => {
  const raw = `${value ?? ''}`.trim();
  if (!raw) {
    return 'Unknown';
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toISOString().slice(0, 16).replace('T', ' ');
};

const toScheduledQueueItems = (runtime): ScheduledQueueItem[] => {
  const pages = Array.isArray(runtime?.content?.list?.('page')) ? runtime.content.list('page') : [];
  const posts = Array.isArray(runtime?.content?.list?.('post')) ? runtime.content.list('post') : [];

  const scheduledPages = pages
    .filter((entry) => resolvePagePublishState(entry).status === 'scheduled')
    .map((entry) => {
      const id = `${entry?.id ?? ''}`;
      const publishedAtMs = new Date(`${entry?.data?.publishedAt ?? ''}`).getTime();
      return {
        id,
        title: `${entry?.data?.title ?? 'Untitled page'}`,
        typeLabel: 'Page' as const,
        publishTimeLabel: formatScheduledTime(entry?.data?.publishedAt),
        editUrl: `/admin/pages/${encodeURIComponent(id)}/edit`,
        publishedAtMs
      };
    });

  const scheduledPosts = posts
    .filter((entry) => resolvePostPublishState(entry).status === 'scheduled')
    .map((entry) => {
      const id = `${entry?.id ?? ''}`;
      const publishedAtMs = new Date(`${entry?.data?.publishedAt ?? ''}`).getTime();
      return {
        id,
        title: `${entry?.data?.title ?? 'Untitled post'}`,
        typeLabel: 'Post' as const,
        publishTimeLabel: formatScheduledTime(entry?.data?.publishedAt),
        editUrl: `/admin/posts/${encodeURIComponent(id)}/edit`,
        publishedAtMs
      };
    });

  return [...scheduledPages, ...scheduledPosts]
    .sort((left, right) => left.publishedAtMs - right.publishedAtMs)
    .slice(0, 10);
};

const renderScheduledQueue = (runtime) => {
  const items = toScheduledQueueItems(runtime);

  if (items.length === 0) {
    return `<article>
      <h2>Upcoming scheduled content</h2>
      <p class="muted">No scheduled pages or posts yet. Schedule from the page/post editor using Publish now with a future publish time.</p>
    </article>`;
  }

  const rows = items.map((item) => `<tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.typeLabel)}</td>
      <td><span class="status-pill status-pill--scheduled">Scheduled</span></td>
      <td>${escapeHtml(item.publishTimeLabel)}</td>
      <td><a href="${item.editUrl}">Edit ${escapeHtml(item.typeLabel.toLowerCase())}</a></td>
    </tr>`).join('');

  return `<article>
      <h2>Upcoming scheduled content</h2>
      <p class="muted">Soonest items first. Times use your server timezone format from scheduling fields.</p>
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
        <tbody>
          ${rows}
        </tbody>
      </table></div>
      <p class="muted">This queue is a lightweight overview. Use Pages and Posts lists for full content management.</p>
    </article>`;
};

const readSiteName = (runtime) => {
  try {
    const value = runtime?.settings?.get?.('site.name');

    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  } catch {
    // Fallback when settings storage is not initialized yet.
  }

  return 'My Nimb Site';
};

const readSystemConfig = (runtime) => {
  if (runtime?.system?.config) {
    return runtime.system.config;
  }

  const projectRoot = runtime?.projectPaths?.projectRoot ?? runtime?.project?.projectRoot;
  return loadSystemConfig({
    projectRoot: typeof projectRoot === 'string' && projectRoot.trim() ? projectRoot : process.cwd(),
    runtimeVersion: runtime?.version
  });
};

export const renderAdminDashboardPage = (runtime, options: DashboardOptions = {}) => {
  const systemConfig = readSystemConfig(runtime);
  const siteName = readSiteName(runtime);
  const version = typeof systemConfig?.version === 'string' && systemConfig.version.trim() !== ''
    ? systemConfig.version
    : runtime?.version ?? '0.0.0';
  const installedAt = typeof systemConfig?.installedAt === 'string' && systemConfig.installedAt.trim() !== ''
    ? systemConfig.installedAt
    : 'Unknown';

  return renderAdminShell({
    title: 'Dashboard · Nimb Admin',
    runtime,
    activeNav: 'dashboard',
    pageTitle: 'Dashboard',
    pageDescription: 'Manage your website content, blog, and settings from one place.',
    notice: options.welcome ? {
      tone: 'success',
      title: 'Welcome to Nimb CMS.',
      message: 'Your site is ready. Create a page, write a post, or update your site settings.'
    } : null,
    content: `<div class="admin-card-grid">
      <article>
        <h2>Start here</h2>
        <ul>
          <li><a href="/admin/pages/new">Create a new page</a></li>
          <li><a href="/admin/posts/new">Write a new post</a></li>
          <li><a href="/admin/settings">Update site settings</a></li>
        </ul>
      </article>
      <article>
        <h2>About this site</h2>
        <ul>
          <li><strong>Site name:</strong> ${escapeHtml(siteName)}</li>
          <li><strong>Version:</strong> ${escapeHtml(version)}</li>
          <li><strong>Installed:</strong> ${escapeHtml(installedAt)}</li>
        </ul>
      </article>
    </div>
    ${renderScheduledQueue(runtime)}
    <article>
      <h2>What you can do now</h2>
      <p class="muted">Nimb currently supports pages, posts, media uploads, and core settings for website-first publishing.</p>
    </article>`
  });
};
