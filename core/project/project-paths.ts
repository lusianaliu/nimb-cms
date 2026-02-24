import path from 'node:path';

export const createProjectPaths = (projectRoot = process.cwd()) => {
  const normalizedRoot = path.resolve(projectRoot);

  return Object.freeze({
    projectRoot: normalizedRoot,
    configDir: path.join(normalizedRoot, 'config'),
    dataDir: path.join(normalizedRoot, 'data'),
    pluginsDir: path.join(normalizedRoot, 'plugins'),
    themesDir: path.join(normalizedRoot, 'themes'),
    persistenceDir: path.join(normalizedRoot, '.nimb'),
    publicDir: path.join(normalizedRoot, 'public')
  });
};
