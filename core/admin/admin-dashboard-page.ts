import { loadSystemConfig } from '../system/system-config.ts';

const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

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

export const renderAdminDashboardPage = (runtime) => {
  const systemConfig = readSystemConfig(runtime);
  const siteName = readSiteName(runtime);
  const version = typeof systemConfig?.version === 'string' && systemConfig.version.trim() !== ''
    ? systemConfig.version
    : runtime?.version ?? '0.0.0';
  const installedAt = typeof systemConfig?.installedAt === 'string' && systemConfig.installedAt.trim() !== ''
    ? systemConfig.installedAt
    : 'Unknown';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Dashboard · Nimb CMS</title>
  </head>
  <body>
    <header>
      <strong>Nimb CMS</strong>
    </header>
    <aside>
      <nav aria-label="Admin menu">
        <ul>
          <li>Dashboard</li>
          <li>Pages</li>
          <li>Posts</li>
          <li>Media</li>
          <li>Themes</li>
          <li>Plugins</li>
          <li>Settings</li>
        </ul>
      </nav>
    </aside>
    <main>
      <h1>Welcome to Nimb CMS</h1>
      <section aria-labelledby="system-info">
        <h2 id="system-info">System info</h2>
        <ul>
          <li>site name: <code>${escapeHtml(siteName)}</code></li>
          <li>version: <code>${escapeHtml(version)}</code></li>
          <li>installedAt: <code>${escapeHtml(installedAt)}</code></li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
};
