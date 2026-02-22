#!/usr/bin/env node
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

let httpServer;

try {
  const startupTimestamp = new Date().toISOString();
  const { config, runtime, snapshot, authService, authMiddleware, adminController } = await createBootstrap({ startupTimestamp });
  httpServer = createHttpServer({
    runtime,
    config,
    startupTimestamp,
    port: 3000,
    authService,
    authMiddleware,
    adminController
  });

  await httpServer.start();

  process.stdout.write('Nimb Runtime Started\n');
  process.stdout.write(`status: ${snapshot.runtimeStatus}\n`);
  process.stdout.write(`plugins: ${snapshot.loadedPlugins.length}\n`);
  process.stdout.write(`mode: ${config.runtime.mode}\n`);
  process.stdout.write('Nimb running at http://localhost:3000\n');
} catch (error) {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
}

const shutdown = async () => {
  if (httpServer) {
    await httpServer.stop();
  }

  process.exit();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
