import http from 'node:http';
import { createRequestHandler } from '../runtime/request-handler.ts';

export const createHttpServer = ({ runtime, config, startupTimestamp, rootDirectory = process.cwd(), port = 3000, clock = () => new Date().toISOString(), authService, authMiddleware, adminController, contentRegistry, persistContentTypes, entryRegistry, persistEntries }) => {
  const handler = createRequestHandler(runtime, {
    config,
    startupTimestamp,
    rootDirectory,
    clock,
    authService,
    authMiddleware,
    adminController,
    contentRegistry,
    persistContentTypes,
    entryRegistry,
    persistEntries
  });

  const server = http.createServer((request, response) => {
    void handler(request, response);
  });

  const listen = (targetPort = port) => new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(new Error(`Failed to start HTTP server on port ${targetPort}: ${error?.message ?? 'unknown error'}`));
    };

    const onListening = () => {
      server.off('error', onError);
      const address = server.address();
      const activePort = typeof address === 'object' && address ? address.port : targetPort;

      if (runtime?.getRuntimeMode?.() === 'installer' && process.env.NODE_ENV !== 'production') {
        process.stdout.write('installer HTTP gate: active\n');
      }

      resolve({ port: activePort });
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(targetPort);
  });

  const close = () => new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });

  return Object.freeze({
    port,
    server,
    listen,
    close,
    start() {
      return listen(port);
    },
    async stop() {
      await close();
      await runtime?.dispose?.();
    }
  });
};
