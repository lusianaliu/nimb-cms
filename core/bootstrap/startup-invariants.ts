import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

export const resolveAdminStaticDir = (config, rootDirectory) => {
  const staticDir = config?.admin?.staticDir ?? './ui/admin';
  return path.isAbsolute(staticDir) ? staticDir : path.resolve(rootDirectory, staticDir);
};

export const validateAdminStaticDir = (config, rootDirectory) => {
  if (config?.admin?.enabled !== true) {
    return;
  }

  const adminDir = resolveAdminStaticDir(config, rootDirectory);
  if (!fs.existsSync(adminDir)) {
    throw new Error(`Startup invariant failed: admin staticDir does not exist: ${adminDir}`);
  }

  if (!fs.statSync(adminDir).isDirectory()) {
    throw new Error(`Startup invariant failed: admin staticDir is not a directory: ${adminDir}`);
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

export const validateDataDirectoryWritable = (projectRoot) => {
  const dataDirectory = path.join(projectRoot, 'data');

  try {
    ensureWritableDirectory(dataDirectory, 'data directory');
  } catch (error) {
    throw new Error(`Startup invariant failed: data directory is not writable: ${dataDirectory}`);
  }
};

export const validatePersistenceStorage = (projectRoot) => {
  const persistenceRoot = path.join(projectRoot, '.nimb');

  try {
    ensureWritableDirectory(persistenceRoot, 'persistence directory');
  } catch (error) {
    throw new Error(`Startup invariant failed: persistence directory is not writable: ${persistenceRoot}`);
  }

  const runtimePath = path.join(persistenceRoot, 'runtime.json');
  if (!fs.existsSync(runtimePath)) {
    return;
  }

  try {
    JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
  } catch (_error) {
    throw new Error(`Startup invariant failed: persistence file is invalid JSON: ${runtimePath}`);
  }
};

export const validatePortAvailable = async (port) => {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Startup invariant failed: invalid port: ${port}`);
  }

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

    server.once('error', () => done(new Error(`Startup invariant failed: port is unavailable: ${port}`)));
    server.once('listening', () => server.close((closeError) => done(closeError ? new Error(`Startup invariant failed: port check failed: ${port}`) : null)));
    server.listen(port, '127.0.0.1');
  });
};

export const validateStartupInvariants = async ({ config, projectRoot, runtimeRoot, port }) => {
  validateAdminStaticDir(config, runtimeRoot);
  validateDataDirectoryWritable(projectRoot);
  validatePersistenceStorage(projectRoot);
  await validatePortAvailable(port);
};
