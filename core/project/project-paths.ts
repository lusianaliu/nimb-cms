import path from 'node:path';

export const createProjectPaths = (projectRoot = process.cwd()) => {
  const normalizedRoot = path.resolve(projectRoot);
  const dataDir = path.join(normalizedRoot, 'data');

  return Object.freeze({
    projectRoot: normalizedRoot,
    configDir: path.join(normalizedRoot, 'config'),
    dataDir,
    pluginsDir: path.join(normalizedRoot, 'plugins'),
    themesDir: path.join(normalizedRoot, 'themes'),
    persistenceDir: path.join(dataDir, 'system'),
    publicDir: path.join(normalizedRoot, 'public'),
    logsDir: path.join(normalizedRoot, 'logs'),
    dataSystemDir: path.join(dataDir, 'system'),
    dataContentDir: path.join(dataDir, 'content'),
    dataUploadsDir: path.join(dataDir, 'uploads')
  });
};
