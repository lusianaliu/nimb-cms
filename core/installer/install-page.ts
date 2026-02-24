export const renderInstallPage = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nimb Setup</title>
  </head>
  <body>
    <main>
      <h1>Nimb Setup</h1>
      <p>Complete installation to initialize this Nimb project.</p>
      <button id="install-button" type="button">Install</button>
      <p id="install-status" role="status" aria-live="polite"></p>
    </main>
    <script>
      const installButton = document.getElementById('install-button');
      const installStatus = document.getElementById('install-status');

      installButton.addEventListener('click', async () => {
        installButton.disabled = true;
        installStatus.textContent = 'Installing...';

        try {
          const response = await fetch('/install', { method: 'POST' });
          if (!response.ok) {
            throw new Error('Install request failed');
          }

          installStatus.textContent = 'Installation completed. Restart server.';
        } catch (_error) {
          installButton.disabled = false;
          installStatus.textContent = 'Installation failed. Please retry.';
        }
      });
    </script>
  </body>
</html>
`;
