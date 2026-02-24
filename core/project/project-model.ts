import path from 'node:path';

export const PROJECT_DIRECTORY_NAMES = Object.freeze({
  content: 'content',
  data: 'data',
  plugins: 'plugins',
  themes: 'themes',
  public: 'public',
  persistence: '.nimb',
  build: '.nimb-build'
});

export const createProjectModel = ({ projectRoot = process.cwd() } = {}) => {
  const root = path.resolve(projectRoot);

  return Object.freeze({
    root,
    configFile: path.join(root, 'nimb.config.json'),
    contentDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.content),
    dataDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.data),
    pluginsDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.plugins),
    themesDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.themes),
    publicDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.public),
    persistenceDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.persistence),
    buildDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.build)
  });
};
