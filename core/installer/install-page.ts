export const renderInstallPage = ({ error = '' }: { error?: string } = {}) => `<!doctype html>
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
      ${error ? `<p role="alert" style="color:#b00020;">${error}</p>` : ''}
      <form method="post" action="/install">
        <label>
          Admin Email
          <input type="email" name="adminEmail" required />
        </label>
        <label>
          Admin Password
          <input type="password" name="adminPassword" minlength="8" required />
        </label>
        <label>
          Site Name
          <input type="text" name="siteName" required />
        </label>
        <button type="submit">Install</button>
      </form>
    </main>
  </body>
</html>
`;
