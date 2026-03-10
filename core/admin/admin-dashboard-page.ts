import { loadSystemConfig } from '../system/system-config.ts';
import { escapeHtml, renderAdminShell } from './admin-shell.ts';

type DashboardOptions = {
  welcome?: boolean
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
    pageDescription: 'Manage your website content and settings from one place.',
    notice: options.welcome ? {
      tone: 'success',
      title: 'Welcome to Nimb.',
      message: 'Your site is ready. Start by creating a page, writing a post, or checking your settings.'
    } : null,
    content: `<div class="admin-card-grid">
      <article>
        <h2>Start here</h2>
        <ul>
          <li><a href="/admin/pages/new">Create your first page</a></li>
          <li><a href="/admin/posts/new">Write your first post</a></li>
          <li><a href="/admin/settings">Review your site settings</a></li>
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
    <article>
      <h2>What you can do now</h2>
      <p class="muted">Nimb currently supports pages, posts, media uploads, and core settings for website-first publishing.</p>
    </article>`
  });
};
