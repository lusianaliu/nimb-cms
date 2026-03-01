import { ADMIN_SESSION_COOKIE, getCookie } from '../http/cookies.ts';

const toRequestPath = (ctx) => {
  const requestPath = `${ctx?.req?.url ?? '/'}`;
  try {
    return new URL(requestPath, 'http://localhost').pathname;
  } catch {
    return '/';
  }
};

const isLoginRoute = (ctx) => {
  const method = `${ctx?.req?.method ?? 'GET'}`.toUpperCase();
  const pathname = toRequestPath(ctx);

  if (pathname !== '/admin/login') {
    return false;
  }

  return method === 'GET' || method === 'POST';
};

const loginRedirectResponse = Object.freeze({
  statusCode: 302,
  send(response) {
    response.writeHead(302, {
      location: '/admin/login',
      'content-length': '0'
    });
    response.end();
  }
});

export const createAdminAuthMiddleware = (runtime) => async (ctx, next) => {

  const pathname = toRequestPath(ctx);
  if (!pathname.startsWith('/admin')) {
    await next();
    return;
  }

  if (isLoginRoute(ctx)) {
    await next();
    return;
  }

  const sessionId = getCookie(ctx.req, ADMIN_SESSION_COOKIE);
  if (!sessionId) {
    ctx.state.response = loginRedirectResponse;
    return;
  }

  const session = await runtime?.sessions?.getSession?.(sessionId);
  if (!session) {
    ctx.state.response = loginRedirectResponse;
    return;
  }

  const user = await runtime?.auth?.findUserById?.(session.userId);
  if (!user) {
    ctx.state.response = loginRedirectResponse;
    return;
  }

  ctx.state.user = user;
  await next();
};
