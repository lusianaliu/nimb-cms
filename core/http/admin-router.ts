import fs from 'node:fs';
import path from 'node:path';

const defaultAdminShell = `<!doctype html>
<html>
<head>
  <title>Nimb Admin</title>
  <style>
    #admin-root {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }

    #admin-body {
      display: grid;
      grid-template-columns: 220px 1fr;
      min-height: 0;
    }
  </style>
</head>
<body>
  <div id="admin-root">
    <header id="admin-header"></header>
    <div id="admin-body">
      <aside id="admin-sidebar"></aside>
      <main id="admin-main"></main>
    </div>
    <footer id="admin-footer"></footer>
  </div>
  <script src="/admin/app.js"></script>
</body>
</html>
`;

const defaultAdminApp = `const createListElement = (items) => {
  const list = document.createElement('ul');

  items.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    list.append(listItem);
  });

  return list;
};

const createSystemInfoElement = (system) => {
  const container = document.createElement('section');

  const lines = [
    \`Name: \${system.name ?? 'Unknown'}\`,
    \`Version: \${system.version ?? 'Unknown'}\`,
    \`Mode: \${system.mode ?? 'Unknown'}\`,
    \`Installed: \${system.installed === true ? 'Yes' : 'No'}\`
  ];

  container.innerHTML = lines.join('<br>');
  return container;
};

const bootstrapLayout = () => {
  const slots = {
    header: document.getElementById('admin-header'),
    sidebar: document.getElementById('admin-sidebar'),
    main: document.getElementById('admin-main'),
    footer: document.getElementById('admin-footer')
  };

  window.NimbAdmin = {
    slots
  };

  const setSlot = (name, element) => {
    const slot = window.NimbAdmin?.slots?.[name];

    if (!slot) {
      return;
    }

    slot.replaceChildren();
    if (element) {
      slot.append(element);
    }
  };

  const clearSlot = (name) => {
    const slot = window.NimbAdmin?.slots?.[name];

    if (!slot) {
      return;
    }

    slot.replaceChildren();
  };

  window.NimbAdmin.setSlot = setSlot;
  window.NimbAdmin.clearSlot = clearSlot;

  const header = document.createElement('strong');
  header.textContent = 'Nimb Admin';
  setSlot('header', header);

  setSlot('sidebar', createListElement(['System']));

  const footer = document.createElement('small');
  footer.textContent = 'Nimb CMS Runtime';
  setSlot('footer', footer);

  const systemFallback = document.createElement('p');
  systemFallback.textContent = 'System information unavailable.';
  setSlot('main', systemFallback);

  void fetch('/admin-api/system')
    .then((response) => {
      if (!response.ok) {
        throw new Error(\`Failed to load system info: \${response.status}\`);
      }

      return response.json();
    })
    .then((system) => {
      setSlot('main', createSystemInfoElement(system));
    })
    .catch(() => {
      // Leave fallback content in place.
    });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLayout, { once: true });
} else {
  bootstrapLayout();
}
`;


const toHtmlResponse = (html: string) => ({
  statusCode: 200,
  send(response) {
    const body = Buffer.from(html, 'utf8');
    response.writeHead(200, {
      'content-length': body.byteLength,
      'content-type': 'text/html; charset=utf-8'
    });
    response.end(body);
  }
});

const toStaticResponse = (body: Buffer, contentType: string) => ({
  statusCode: 200,
  send(response) {
    response.writeHead(200, {
      'content-length': body.byteLength,
      'content-type': contentType
    });
    response.end(body);
  }
});

const loadAdminShell = (rootDirectory: string) => {
  const shellPath = path.resolve(rootDirectory, 'admin/index.html');

  if (!fs.existsSync(shellPath) || !fs.statSync(shellPath).isFile()) {
    return defaultAdminShell;
  }

  return fs.readFileSync(shellPath, 'utf8');
};

const resolveAdminAsset = (rootDirectory: string, requestPath: string) => {
  const relativePath = requestPath.replace(/^\/admin\/?/, '');

  if (!relativePath || relativePath.endsWith('/')) {
    return null;
  }

  const assetRoot = path.resolve(rootDirectory, 'admin');
  const assetPath = path.resolve(assetRoot, relativePath);

  if (assetPath.startsWith(`${assetRoot}${path.sep}`) && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    if (assetPath.endsWith('.js')) {
      return toStaticResponse(fs.readFileSync(assetPath), 'application/javascript; charset=utf-8');
    }

    if (assetPath.endsWith('.css')) {
      return toStaticResponse(fs.readFileSync(assetPath), 'text/css; charset=utf-8');
    }

    return null;
  }

  if (relativePath === 'app.js') {
    return toStaticResponse(Buffer.from(defaultAdminApp, 'utf8'), 'application/javascript; charset=utf-8');
  }

  return null;
};

export const createAdminRouter = ({ rootDirectory = process.cwd() } = {}) => {
  const normalizedBasePath = '/admin';
  const shell = loadAdminShell(rootDirectory);

  return Object.freeze({
    dispatch(context) {
      if (context.method !== 'GET') {
        return null;
      }

      if (context.path === normalizedBasePath || context.path === `${normalizedBasePath}/`) {
        return () => toHtmlResponse(shell);
      }

      if (context.path.startsWith(`${normalizedBasePath}/`)) {
        const assetResponse = resolveAdminAsset(rootDirectory, context.path);
        if (assetResponse) {
          return () => assetResponse;
        }

        return () => toHtmlResponse(shell);
      }

      return null;
    }
  });
};
