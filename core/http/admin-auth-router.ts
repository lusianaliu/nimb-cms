import { createRouter } from './router.ts';
import { ADMIN_SESSION_COOKIE, clearCookie, getCookie, setCookie } from './cookies.ts';
import { renderLoginView } from '../admin/views/login.ts';

const toHtmlResponse = (html: string, statusCode = 200) => ({
  statusCode,
  send(response) {
    const body = Buffer.from(html, 'utf8');
    response.writeHead(statusCode, {
      'content-length': body.byteLength,
      'content-type': 'text/html; charset=utf-8'
    });
    response.end(body);
  }
});

const setupView = ({ error = '', siteName = 'My Nimb Site', email = 'admin@nimb.local' }: { error?: string, siteName?: string, email?: string } = {}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Setup · Nimb</title>
  </head>
  <body>
    <main>
      <h1>Admin setup</h1>
      <p>Complete first-time setup to continue.</p>
      ${error ? `<p role="alert" style="color:#b00020;">${error}</p>` : ''}
      <form method="post" action="/admin/setup">
        <label>
          Site name
          <input name="siteName" type="text" value="${siteName}" required>
        </label>
        <label>
          Admin email
          <input name="email" type="email" value="${email}" required>
        </label>
        <label>
          New password
          <input name="password" type="password" minlength="8" required>
        </label>
        <button type="submit">Save and continue</button>
      </form>
    </main>
  </body>
</html>`;


const resolveAdminNext = (value: unknown, fallback = '/admin') => {
  const next = `${value ?? ''}`.trim();
  return next.startsWith('/admin') ? next : fallback;
};

const readFormBody = async (request) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
};

export const createAdminAuthRouter = (runtime) => {
  const router = createRouter([
    {
      method: 'GET',
      path: '/admin/login',
      handler: async (context) => {
        const welcome = `${context.query?.welcome ?? ''}` === '1';
        const installComplete = `${context.query?.install ?? ''}` === 'complete';
        const loggedOut = `${context.query?.logged_out ?? ''}` === '1';
        const notice = welcome
          ? 'Installation complete. Sign in to open your admin dashboard.'
          : installComplete
            ? 'Nimb is already installed. Sign in to continue.'
            : loggedOut
              ? 'You are signed out.'
              : '';
        const sessionId = getCookie(context.request, ADMIN_SESSION_COOKIE);
        if (sessionId) {
          const session = await runtime?.sessions?.getSession?.(sessionId);
          const user = session ? await runtime?.auth?.findUserById?.(session.userId) : null;
          if (session && user) {
            return {
              statusCode: 302,
              send(response) {
                response.writeHead(302, { location: '/admin', 'content-length': '0' });
                response.end();
              }
            };
          }
        }

        const next = welcome ? '/admin?welcome=1' : '';
        return toHtmlResponse(renderLoginView({ title: 'Login · Nimb Admin', notice, next }));
      }
    },
    {
      method: 'POST',
      path: '/admin/login',
      handler: async (context) => {
        const form = await readFormBody(context.request);
        const email = `${form.email ?? ''}`.trim().toLowerCase();
        const password = `${form.password ?? ''}`;
        const next = resolveAdminNext(form.next);

        if (!email || !password) {
          return toHtmlResponse(renderLoginView({ title: 'Login · Nimb Admin', email, error: 'Email and password are required.' }), 400);
        }

        const user = await runtime.auth.findUserByEmail(email);
        if (!user) {
          return toHtmlResponse(renderLoginView({ title: 'Login · Nimb Admin', email, error: 'Invalid credentials.' }), 401);
        }

        const validPassword = await runtime.auth.verifyPassword(password, user.passwordHash);
        if (!validPassword) {
          return toHtmlResponse(renderLoginView({ title: 'Login · Nimb Admin', email, error: 'Invalid credentials.' }), 401);
        }

        const session = await runtime.sessions.createSession(user.id);

        return {
          statusCode: 302,
          send(response) {
            setCookie(response, ADMIN_SESSION_COOKIE, session.id);
            response.writeHead(302, {
              location: next,
              'content-length': '0'
            });
            response.end();
          }
        };
      }
    },
    {
      method: 'GET',
      path: '/admin/setup',
      handler: async () => {
        const adminUser = await runtime?.auth?.findUserByEmail?.('admin@nimb.local');
        const siteName = `${runtime?.settings?.get?.('site.name') ?? 'My Nimb Site'}`;
        return toHtmlResponse(setupView({ siteName, email: `${adminUser?.email ?? 'admin@nimb.local'}` }));
      }
    },
    {
      method: 'POST',
      path: '/admin/setup',
      handler: async (context) => {
        const form = await readFormBody(context.request);
        const siteName = `${form.siteName ?? ''}`.trim();
        const email = `${form.email ?? ''}`.trim().toLowerCase();
        const password = `${form.password ?? ''}`;
        const next = resolveAdminNext(form.next);

        if (!siteName || !email || password.length < 8) {
          return toHtmlResponse(setupView({
            error: 'Site name, valid email, and a password with at least 8 characters are required.',
            siteName: siteName || 'My Nimb Site',
            email: email || 'admin@nimb.local'
          }), 400);
        }

        await runtime?.settings?.set?.('site.name', siteName);
        await runtime?.auth?.updateAdminCredentials?.({ email, password });

        return {
          statusCode: 302,
          send(response) {
            response.writeHead(302, {
              location: next,
              'content-length': '0'
            });
            response.end();
          }
        };
      }
    },
    {
      method: 'POST',
      path: '/admin/logout',
      handler: async (context) => {
        const sessionId = getCookie(context.request, ADMIN_SESSION_COOKIE);

        if (sessionId) {
          await runtime.sessions.destroySession(sessionId);
        }

        return {
          statusCode: 302,
          send(response) {
            clearCookie(response, ADMIN_SESSION_COOKIE);
            response.writeHead(302, {
              location: '/admin/login?logged_out=1',
              'content-length': '0'
            });
            response.end();
          }
        };
      }
    }
  ]);

  return Object.freeze({
    dispatch: (context) => router.dispatch(context)
  });
};
