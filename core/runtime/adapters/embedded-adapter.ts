import type { RuntimeAdapter } from './types.ts';
import { createRequestHandler } from '../request-handler.ts';

export const createEmbeddedAdapter = ({ runtime, ...options }) => {
  const handler = createRequestHandler(runtime, options);

  const adapter: RuntimeAdapter & { handler: ReturnType<typeof createRequestHandler> } = Object.freeze({
    handler,
    async start() {},
    async stop() {}
  });

  return adapter;
};
