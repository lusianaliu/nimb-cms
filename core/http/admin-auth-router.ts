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

const toRedirectResponse = (location: string, statusCode = 302) => ({
  statusCode,
  send(response) {
    response.writeHead(statusCode, { location, 'content-length': '0' });
    response.end();
  }
});

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
      handler: () => toHtmlResponse(renderLoginView({ title: 'Login · Nimb Admin' }))
    },
    {
      method: 'POST',
      path: '/admin/login',
      handler: async (context) => {
        const form = await readFormBody(context.request);
        const email = `${form.email ?? ''}`.trim().toLowerCase();
        const password = `${form.password ?? ''}`;

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
              location: '/admin',
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
              location: '/admin/login',
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
