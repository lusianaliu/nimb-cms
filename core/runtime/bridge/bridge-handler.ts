import { createRequestHandler } from '../request-handler.ts';

const toAsyncIterable = (body: unknown) => ({
  async *[Symbol.asyncIterator]() {
    if (body === undefined || body === null) {
      return;
    }

    if (typeof body === 'string') {
      yield Buffer.from(body, 'utf8');
      return;
    }

    if (body instanceof Uint8Array) {
      yield body;
      return;
    }

    yield Buffer.from(String(body), 'utf8');
  }
});

const normalizeHeaders = (headers: unknown): Record<string, string> => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  if (typeof (headers as { entries?: () => IterableIterator<[string, string]> }).entries === 'function') {
    return Object.fromEntries(Array.from((headers as { entries: () => IterableIterator<[string, string]> }).entries(), ([key, value]) => [key.toLowerCase(), String(value)]));
  }

  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
};

const isNodeLikeRequest = (request: unknown) => (
  Boolean(request)
  && typeof request === 'object'
  && typeof (request as { method?: string }).method === 'string'
  && typeof (request as { url?: string }).url === 'string'
  && typeof (request as { headers?: unknown }).headers === 'object'
);

const normalizeRequest = (request: unknown) => {
  if (isNodeLikeRequest(request)) {
    return request;
  }

  const source = request as { method?: string; url?: string; headers?: unknown; body?: unknown };

  return {
    method: source?.method ?? 'GET',
    url: source?.url ?? '/',
    headers: normalizeHeaders(source?.headers),
    ...toAsyncIterable(source?.body)
  };
};

const isNodeLikeResponse = (response: unknown) => (
  Boolean(response)
  && typeof response === 'object'
  && typeof (response as { setHeader?: unknown }).setHeader === 'function'
  && typeof (response as { writeHead?: unknown }).writeHead === 'function'
  && typeof (response as { end?: unknown }).end === 'function'
);

const normalizeResponse = (response: unknown) => {
  if (isNodeLikeResponse(response)) {
    return response;
  }

  const source = response as {
    statusCode?: number
    status?: number
    headers?: Record<string, string>
    setHeader?: (name: string, value: string) => void
    writeHead?: (statusCode: number, headers: Record<string, string>) => void
    end?: (payload?: Buffer | string) => void
  };

  const state = {
    statusCode: Number.isInteger(source?.statusCode) ? Number(source.statusCode) : (Number.isInteger(source?.status) ? Number(source.status) : 200),
    headers: { ...(source?.headers ?? {}) }
  };

  const writeHead = (statusCode: number, headers: Record<string, string | number> = {}) => {
    state.statusCode = statusCode;

    for (const [key, value] of Object.entries(headers)) {
      state.headers[key.toLowerCase()] = String(value);
    }

    if (typeof source?.writeHead === 'function') {
      source.writeHead(statusCode, state.headers);
    }
  };

  return {
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(value: number) {
      state.statusCode = Number(value);
    },
    setHeader(name: string, value: string | number) {
      state.headers[name.toLowerCase()] = String(value);
      if (typeof source?.setHeader === 'function') {
        source.setHeader(name, String(value));
      }
    },
    writeHead,
    end(payload?: Buffer | string) {
      if (typeof source?.writeHead === 'function') {
        source.writeHead(state.statusCode, state.headers);
      }

      if (typeof source?.end === 'function') {
        source.end(payload);
      }
    }
  };
};

// Intent: keep the bridge surface generic so external hosts can forward requests without coupling to Node's http server.
export const createBridgeHandler = (runtime, options = {}) => {
  const requestHandler = createRequestHandler(runtime, options);

  return async (request, response) => requestHandler(normalizeRequest(request), normalizeResponse(response));
};
