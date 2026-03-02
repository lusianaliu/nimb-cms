import { saveSystemConfig } from '../system/system-config.ts';
import { bootstrapDefaultSite } from './bootstrap-default-site.ts';

const resolveProjectPaths = (runtime) => runtime?.projectPaths ?? runtime?.project ?? null;

export const handleInstall = async (_request, runtime) => {
  const projectPaths = resolveProjectPaths(runtime);
  const projectRoot = projectPaths?.projectRoot;

  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') {
    return { success: false, error: { code: 'INSTALL_PATH_UNAVAILABLE', message: 'Project path is unavailable' } };
  }

  if (runtime?.system?.installed === true) {
    return { success: false, error: { code: 'ALREADY_INSTALLED', message: 'Project is already installed' } };
  }

  const installState = saveSystemConfig({
    installed: true,
    installedAt: new Date().toISOString(),
    version: runtime?.version ?? 'dev'
  }, { projectRoot });

  runtime.system = Object.freeze({
    config: installState,
    installed: true
  });

  await bootstrapDefaultSite(projectPaths);
  await runtime?.events?.emit?.('system.installed', { version: installState.version, installedAt: installState.installedAt });
  process.stdout.write('installation completed\n');

  return { success: true, data: { install: installState }, meta: {} };
};
