import { saveSystemConfig, getInstallState } from '../system/system-config.ts';

// Legacy setup-state shim retained for compatibility in tests and older modules.
// Phase 144 lock-in: install state is canonical in data/system/config.json.
const resolveProjectRoot = (projectRoot?: string) => projectRoot ?? process.cwd();

export const isInstalled = ({ projectRoot = process.cwd() }: { projectRoot?: string } = {}): boolean => getInstallState({ projectRoot }).installed;

export const markInstalled = (metadata: { version?: string, projectRoot?: string } = {}) => {
  const projectRoot = resolveProjectRoot(metadata.projectRoot);
  const installState = saveSystemConfig({
    installed: true,
    installedAt: new Date().toISOString(),
    version: String(metadata.version ?? '0.0.0')
  }, { projectRoot });

  return Object.freeze({
    installed: installState.installed === true,
    installedAt: String(installState.installedAt ?? ''),
    version: installState.version
  });
};
