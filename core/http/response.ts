const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));

    return keys.reduce((accumulator, key) => {
      accumulator[key] = canonicalize(value[key]);
      return accumulator;
    }, {});
  }

  return value;
};

const writeJson = (response, statusCode, payload) => {
  const body = `${JSON.stringify(canonicalize(payload))}\n`;
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  response.end(body);
};

export const jsonResponse = (payload, { statusCode = 200 } = {}) => ({
  statusCode,
  payload,
  send(response) {
    writeJson(response, statusCode, payload);
  }
});

export const errorResponse = ({ code = 'INTERNAL_ERROR', message = 'Internal Server Error', timestamp }) => jsonResponse({
  error: {
    code,
    message
  },
  timestamp
}, { statusCode: 500 });

export const notFoundResponse = ({ path, timestamp }) => jsonResponse({
  error: {
    code: 'NOT_FOUND',
    message: `Route not found: ${path}`
  },
  timestamp
}, { statusCode: 404 });


export const redirectResponse = (location, { statusCode = 302 } = {}) => ({
  statusCode,
  location,
  send(response) {
    response.writeHead(statusCode, {
      location,
      'content-length': '0'
    });
    response.end();
  }
});
