export const JSON_HEADER = { 'Content-Type': 'application/json' };

export function respondJson(res, statusCode, payload) {
  res.writeHead(statusCode, JSON_HEADER);
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(req, res) {
  const body = await new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    respondJson(res, 400, { error: 'Invalid JSON payload' });
    return null;
  }
}

export function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index === -1) {
        return acc;
      }

      const name = part.slice(0, index);
      const value = part.slice(index + 1);
      acc[name] = value;
      return acc;
    }, {});
}
