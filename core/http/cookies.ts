const SESSION_COOKIE_NAME = 'nimb_admin_session';

type CookieOptions = {
  httpOnly?: boolean
  path?: string
  maxAge?: number
  expires?: Date
};

const serializeCookie = (name: string, value: string, options: CookieOptions = {}) => {
  const attributes = [`${name}=${encodeURIComponent(value)}`];
  attributes.push(`Path=${options.path ?? '/'}`);

  if (options.httpOnly !== false) {
    attributes.push('HttpOnly');
  }

  if (typeof options.maxAge === 'number') {
    attributes.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.expires instanceof Date) {
    attributes.push(`Expires=${options.expires.toUTCString()}`);
  }

  return attributes.join('; ');
};

const appendSetCookieHeader = (res, cookie: string) => {
  const previous = res.getHeader?.('set-cookie');

  if (!previous) {
    res.setHeader('set-cookie', cookie);
    return;
  }

  if (Array.isArray(previous)) {
    res.setHeader('set-cookie', [...previous, cookie]);
    return;
  }

  res.setHeader('set-cookie', [String(previous), cookie]);
};

export const setCookie = (res, name: string, value: string, options: CookieOptions = {}) => {
  const cookie = serializeCookie(name, value, {
    path: '/',
    httpOnly: true,
    ...options
  });

  appendSetCookieHeader(res, cookie);
};

export const getCookie = (req, name: string) => {
  const raw = req?.headers?.cookie;
  const cookieHeader = Array.isArray(raw) ? raw.join(';') : `${raw ?? ''}`;
  if (!cookieHeader.trim()) {
    return null;
  }

  for (const entry of cookieHeader.split(';')) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== name) {
      continue;
    }

    return decodeURIComponent(trimmed.slice(separatorIndex + 1).trim());
  }

  return null;
};

export const clearCookie = (res, name: string) => {
  setCookie(res, name, '', { maxAge: 0, expires: new Date(0) });
};

export const ADMIN_SESSION_COOKIE = SESSION_COOKIE_NAME;
