const escapeHtml = (value) => `${value}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const toRuntimeMode = (runtime) => {
  const mode = runtime?.getRuntimeMode?.() ?? runtime?.runtimeMode;
  if (typeof mode === 'string' && mode.trim() !== '') {
    return mode;
  }

  return 'unknown';
};

const toRuntimeVersion = (runtime) => {
  const version = runtime?.version;
  if (typeof version === 'string' && version.trim() !== '') {
    return version;
  }

  return 'unknown';
};

const toAdminBasePath = (runtime, resolvedBasePath) => {
  const basePath = resolvedBasePath ?? runtime?.adminBasePath;
  if (typeof basePath === 'string' && basePath.trim() !== '') {
    return basePath;
  }

  return '/admin';
};

export const renderDashboardPage = ({ runtime, adminBasePath }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nimb Dashboard</title>
  </head>
  <body>
    <header>
      <h1>Dashboard</h1>
    </header>
    <main>
      <section aria-labelledby="system-info">
        <h2 id="system-info">System info</h2>
        <ul>
          <li>runtime.version: <code>${escapeHtml(toRuntimeVersion(runtime))}</code></li>
          <li>runtimeMode: <code>${escapeHtml(toRuntimeMode(runtime))}</code></li>
          <li>adminBasePath: <code>${escapeHtml(toAdminBasePath(runtime, adminBasePath))}</code></li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
