#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, createRuntime, createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const projectRoot = process.cwd();
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const startupTimestamp = new Date().toISOString();

const resolvePort = (config) => {
  const fromEnv = process.env.PORT;
  if (fromEnv !== undefined && `${fromEnv}`.trim() !== '') {
    const envPort = Number(fromEnv);
    if (!Number.isInteger(envPort) || envPort < 0 || envPort > 65535) {
      throw new Error(`Invalid PORT environment variable: ${fromEnv}`);
    }

    return envPort;
  }

  if (config?.server?.port !== undefined) {
    return config.server.port;
  }

  return 3000;
};

const resolveAdminStaticDir = (config, rootDirectory) => {
  const staticDir = config?.admin?.staticDir ?? './ui/admin';
  return path.isAbsolute(staticDir) ? staticDir : path.resolve(rootDirectory, staticDir);
};

const validateAdminStaticDir = (config, rootDirectory) => {
  if (config?.admin?.enabled !== true) {
    return;
  }

  const adminDir = resolveAdminStaticDir(config, rootDirectory);
  if (!fs.existsSync(adminDir)) {
    throw new Error(`Admin staticDir does not exist: ${adminDir}`);
  }

  if (!fs.statSync(adminDir).isDirectory()) {
    throw new Error(`Admin staticDir is not a directory: ${adminDir}`);
  }
};

let httpServer;

try {
  const config = loadConfig({ cwd: projectRoot });
  validateAdminStaticDir(config, runtimeRoot);
  const port = resolvePort(config);

  createRuntime(config);
  const bootstrap = await createBootstrap({ cwd: projectRoot, startupTimestamp });

  httpServer = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp,
    rootDirectory: runtimeRoot,
    port,
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController,
    contentRegistry: bootstrap.contentRegistry,
    persistContentTypes: bootstrap.persistContentTypes,
    entryRegistry: bootstrap.entryRegistry,
    persistEntries: bootstrap.persistEntries
  });

  const { port: activePort } = await httpServer.start();

  process.stdout.write('Nimb CMS starting...\n');
  process.stdout.write('Mode: standalone\n');
  process.stdout.write(`Port: ${activePort}\n`);
  process.stdout.write(`Admin path: ${bootstrap.config.admin.basePath}\n`);
  process.stdout.write(`Plugins loaded: ${bootstrap.snapshot.loadedPlugins.length}\n`);
  process.stdout.write('Ready.\n');
} catch (error) {
  process.stderr.write(`Startup failed: ${error?.message ?? String(error)}\n`);
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
