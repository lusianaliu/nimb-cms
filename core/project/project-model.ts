import path from 'node:path';
import { createProjectPaths } from './project-paths.ts';

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
  const projectPaths = createProjectPaths(projectRoot);
  const root = projectPaths.projectRoot;

  return Object.freeze({
    root,
    projectRoot: projectPaths.projectRoot,
    configDir: projectPaths.configDir,
    dataDir: projectPaths.dataDir,
    pluginsDir: projectPaths.pluginsDir,
    themesDir: projectPaths.themesDir,
    persistenceDir: projectPaths.persistenceDir,
    publicDir: projectPaths.publicDir,
    configFile: path.join(root, 'nimb.config.json'),
    contentDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.content),
    dataDirectory: projectPaths.dataDir,
    pluginsDirectory: projectPaths.pluginsDir,
    themesDirectory: projectPaths.themesDir,
    publicDirectory: projectPaths.publicDir,
    persistenceDirectory: projectPaths.persistenceDir,
    buildDirectory: path.join(root, PROJECT_DIRECTORY_NAMES.build)
  });
};
