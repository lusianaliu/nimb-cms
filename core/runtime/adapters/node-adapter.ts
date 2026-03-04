import { createHttpServer } from '../../http/http-server.ts';
import type { RuntimeAdapter } from './types.ts';

export const createNodeAdapter = ({
  runtime,
  config,
  startupTimestamp,
  rootDirectory = process.cwd(),
  port = 3000,
  clock = () => new Date().toISOString(),
  authService,
  authMiddleware,
  adminController,
  contentRegistry,
  persistContentTypes,
  entryRegistry,
  persistEntries
}) => {
  const server = createHttpServer({
    runtime,
    config,
    startupTimestamp,
    rootDirectory,
    port,
    clock,
    authService,
    authMiddleware,
    adminController,
    contentRegistry,
    persistContentTypes,
    entryRegistry,
    persistEntries
  });

  let activePort = null;

  const adapter: RuntimeAdapter & { server: ReturnType<typeof createHttpServer>, getPort: () => number | null } = Object.freeze({
    server,
    async start() {
      const started = await server.start();
      activePort = started.port;
    },
    async stop() {
      await server.stop();
    },
    getPort() {
      return activePort;
    }
  });

  return adapter;
};
