import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { SHARED_STARTUP_PREFLIGHT_INVARIANTS } from '../invariants/startup-preflight-invariants.ts';
import { STARTUP_PORT_INVARIANT, assertValidStartupPort, formatStartupPortInvariantFailure } from '../invariants/startup-port.ts';
import { formatPersistenceRuntimeJsonInvariantFailure } from '../invariants/persistence-runtime-json.ts';

const ADMIN_STATIC_DIR_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.adminStaticDir;
const DATA_DIRECTORY_WRITABLE_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.dataDirectoryWritable;
const PERSISTENCE_DIRECTORY_WRITABLE_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceDirectoryWritable;
const LOGS_DIRECTORY_WRITABLE_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable;

export const resolveAdminStaticDir = (config, rootDirectory) => {
  const staticDir = config?.admin?.staticDir ?? './ui/admin';
  return path.isAbsolute(staticDir) ? staticDir : path.resolve(rootDirectory, staticDir);
};

export const validateAdminStaticDir = (config, rootDirectory) => {
  if (config?.admin?.enabled !== true) {
    return;
  }

  const staticDir = config?.admin?.staticDir;
  const adminDir = resolveAdminStaticDir(config, rootDirectory);

  // Admin static assets are presentation-only and can be absent in runtime/test
  // environments where the handler serves built-in fallbacks.
  if (!fs.existsSync(adminDir)) {
    if (typeof staticDir !== 'string' || staticDir.trim() === '') {
      return;
    }

    throw new Error(`Startup invariant failed [${ADMIN_STATIC_DIR_INVARIANT.id}]: admin staticDir does not exist: ${adminDir}`);
  }

  if (!fs.statSync(adminDir).isDirectory()) {
    throw new Error(`Startup invariant failed [${ADMIN_STATIC_DIR_INVARIANT.id}]: admin staticDir is not a directory: ${adminDir}`);
  }
};

const ensureWritableDirectory = (directoryPath, label) => {
  fs.mkdirSync(directoryPath, { recursive: true });
  const probePath = path.join(directoryPath, '.nimb-write-check.tmp');
  fs.writeFileSync(probePath, 'ok\n');
  fs.rmSync(probePath, { force: true });

  if (!fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`Startup invariant failed: ${label} is not a directory: ${directoryPath}`);
  }
};

const startupLog = (log, message) => {
  if (typeof log === 'function') {
    log(message);
  }
};

const ensureDirectory = (directoryPath, label, log) => {
  const existedBefore = fs.existsSync(directoryPath);
  ensureWritableDirectory(directoryPath, label);
  startupLog(log, `Startup invariant: ${existedBefore ? 'verified' : 'created'} ${label}: ${directoryPath}`);
};

export const validateDataDirectoryWritable = (project, options = {}) => {
  const dataDirectory = project.dataDir ?? project.dataDirectory;
  const systemDirectory = project.dataSystemDir ?? path.join(dataDirectory, 'system');
  const contentDirectory = project.dataContentDir ?? path.join(dataDirectory, 'content');
  const uploadsDirectory = project.dataUploadsDir ?? path.join(dataDirectory, 'uploads');

  try {
    ensureDirectory(dataDirectory, 'data directory', options.log);
    ensureDirectory(systemDirectory, 'data system directory', options.log);
    ensureDirectory(contentDirectory, 'data content directory', options.log);
    ensureDirectory(uploadsDirectory, 'data uploads directory', options.log);
  } catch (error) {
    throw new Error(`Startup invariant failed [${DATA_DIRECTORY_WRITABLE_INVARIANT.id}]: data directory is not writable: ${dataDirectory}`);
  }
};

export const validatePersistenceStorage = (project, options = {}) => {
  const persistenceRoot = project.persistenceDir ?? project.persistenceDirectory;

  try {
    ensureDirectory(persistenceRoot, 'persistence directory', options.log);
  } catch (error) {
    throw new Error(`Startup invariant failed [${PERSISTENCE_DIRECTORY_WRITABLE_INVARIANT.id}]: persistence directory is not writable: ${persistenceRoot}`);
  }

  const runtimePath = path.join(persistenceRoot, 'runtime.json');
  if (!fs.existsSync(runtimePath)) {
    return;
  }

  try {
    JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
  } catch (_error) {
    throw new Error(formatPersistenceRuntimeJsonInvariantFailure(`persistence file is invalid JSON: ${runtimePath}`));
  }
};


export const validateLogsDirectoryWritable = (project, options = {}) => {
  const logsDirectory = project.logsDir ?? path.join(project.projectRoot ?? process.cwd(), 'logs');

  try {
    ensureDirectory(logsDirectory, 'logs directory', options.log);
  } catch (error) {
    throw new Error(`Startup invariant failed [${LOGS_DIRECTORY_WRITABLE_INVARIANT.id}]: logs directory is not writable: ${logsDirectory}`);
  }
};

export const validatePortAvailable = async (port) => {
  const validatedPort = assertValidStartupPort(port, 'port');

  await new Promise((resolve, reject) => {
    const server = net.createServer();

    const done = (error) => {
      server.removeAllListeners();
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    };

    server.once('error', () => done(new Error(formatStartupPortInvariantFailure(`port is unavailable: ${validatedPort}`))));
    server.once('listening', () => server.close((closeError) => done(closeError ? new Error(formatStartupPortInvariantFailure(`port check failed: ${validatedPort}`)) : null)));
    server.listen(validatedPort, '127.0.0.1');
  });
};

export const validateStartupInvariants = async ({ config, project, runtimeRoot, port }) => {
  const log = (message) => process.stdout.write(`${message}\n`);
  validateAdminStaticDir(config, runtimeRoot);
  validateDataDirectoryWritable(project, { log });
  validatePersistenceStorage(project, { log });
  validateLogsDirectoryWritable(project, { log });
  await validatePortAvailable(port);
};
