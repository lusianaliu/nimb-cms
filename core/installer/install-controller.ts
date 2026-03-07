import { saveSystemConfig } from '../system/system-config.ts';
import { bootstrapDefaultSite } from './bootstrap-default-site.ts';
import { hasInstallLock, writeInstallLock } from './install-lock.ts';

const resolveProjectPaths = (runtime) => runtime?.projectPaths ?? runtime?.project ?? null;

type InstallInput = {
  adminEmail: string
  adminPassword: string
  siteName: string
};

const normalizeInput = (input: Partial<InstallInput> = {}): InstallInput => Object.freeze({
  adminEmail: `${input.adminEmail ?? ''}`.trim().toLowerCase(),
  adminPassword: `${input.adminPassword ?? ''}`,
  siteName: `${input.siteName ?? ''}`.trim()
});

export const handleInstall = async (_request, runtime, input: Partial<InstallInput> = {}) => {
  const projectPaths = resolveProjectPaths(runtime);
  const projectRoot = projectPaths?.projectRoot;

  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') {
    return { success: false, error: { code: 'INSTALL_PATH_UNAVAILABLE', message: 'Project path is unavailable' } };
  }

  if (hasInstallLock({ projectRoot })) {
    return { success: false, error: { code: 'ALREADY_INSTALLED', message: 'Project is already installed' } };
  }

  const normalized = normalizeInput(input);
  if (!normalized.adminEmail || normalized.adminPassword.length < 8 || !normalized.siteName) {
    return { success: false, error: { code: 'INVALID_INSTALL_INPUT', message: 'Admin email, admin password (min 8), and site name are required.' } };
  }

  const installedAt = new Date().toISOString();
  const installState = saveSystemConfig({
    installed: true,
    installedAt,
    version: runtime?.version ?? 'dev'
  }, { projectRoot });

  const existingAdmin = await runtime?.auth?.findUserByEmail?.(normalized.adminEmail);
  if (!existingAdmin) {
    await runtime?.auth?.createUser?.({
      username: 'admin',
      email: normalized.adminEmail,
      password: normalized.adminPassword
    });
  } else {
    await runtime?.auth?.updateAdminCredentials?.({
      email: normalized.adminEmail,
      password: normalized.adminPassword
    });
  }

  await runtime?.settings?.set?.('site.name', normalized.siteName);
  writeInstallLock({ projectRoot });

  runtime.system = Object.freeze({
    config: installState,
    installed: true
  });

  await bootstrapDefaultSite(projectPaths);
  await runtime?.events?.emit?.('system.installed', { version: installState.version, installedAt: installState.installedAt });

  return {
    success: true,
    data: {
      install: installState
    },
    meta: {}
  };
};
