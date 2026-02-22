export const createAuthMiddleware = ({ authService }: { authService: { getSession: (token: string) => unknown } }) => ({
  attach(context: { request: { headers: Record<string, string | string[] | undefined> } }) {
    const header = context.request.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : null;

    const session = token ? authService.getSession(token) : null;

    return Object.freeze({
      token,
      authenticated: Boolean(session),
      session
    });
  }
});
