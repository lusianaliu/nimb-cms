import { loadSystemConfig, type SystemConfig } from '../system/system-config.ts';

// Legacy install-state adapter preserved for compatibility with older tests/modules.
// Phase 144 lock-in: active install ownership now reads from data/system/config.json.
export const INSTALL_STATE_FILENAME = 'install.json';

export type InstallState = {
  installed: boolean;
  version: string;
  installedAt: string;
};

const resolveProjectRoot = (projectModel) => projectModel?.projectRoot ?? projectModel?.root ?? process.cwd();

const toLegacyInstallState = (config: SystemConfig): InstallState | null => {
  if (config.installed !== true || typeof config.installedAt !== 'string') {
    return null;
  }

  return Object.freeze({
    installed: true,
    version: String(config.version),
    installedAt: config.installedAt
  });
};

export const readInstallState = (projectModel): InstallState | null => {
  const projectRoot = resolveProjectRoot(projectModel);
  const config = loadSystemConfig({ projectRoot });
  return toLegacyInstallState(config);
};

export const isProjectInstalled = (projectModel): boolean => readInstallState(projectModel) !== null;
