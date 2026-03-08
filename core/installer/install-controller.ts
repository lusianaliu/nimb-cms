import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { saveSystemConfig } from '../system/system-config.ts';
import { bootstrapDefaultSite } from './bootstrap-default-site.ts';
import { hasInstallLock, writeInstallLock } from './install-lock.ts';

const resolveProjectPaths = (runtime) => runtime?.projectPaths ?? runtime?.project ?? null;

type InstallInput = {
  siteTitle: string
  adminUser: string
  adminPassword: string
};

const ADMIN_STATE_RELATIVE_PATH = path.join('data', 'system', 'admin.json');

const normalizeInput = (input: Partial<InstallInput> = {}): InstallInput => Object.freeze({
  siteTitle: `${input.siteTitle ?? ''}`.trim(),
  adminUser: `${input.adminUser ?? ''}`.trim(),
  adminPassword: `${input.adminPassword ?? ''}`
});

const hashAdminPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${passwordHash}`;
};

const writeInstallerAdminState = ({ projectRoot, username, passwordHash }: { projectRoot: string, username: string, passwordHash: string }) => {
  const adminPath = path.join(projectRoot, ADMIN_STATE_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(adminPath), { recursive: true });
  fs.writeFileSync(adminPath, `${JSON.stringify({ username, passwordHash }, null, 2)}\n`, 'utf8');
};

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
  if (!normalized.siteTitle || !normalized.adminUser || normalized.adminPassword.length < 8) {
    return { success: false, error: { code: 'INVALID_INSTALL_INPUT', message: 'Site title, admin user, and admin password (min 8) are required.' } };
  }

  const installedAt = new Date().toISOString();
  const installState = saveSystemConfig({
    installed: true,
    installedAt,
    version: runtime?.version ?? 'dev',
    siteTitle: normalized.siteTitle
  }, { projectRoot });

  const passwordHash = hashAdminPassword(normalized.adminPassword);
  writeInstallerAdminState({
    projectRoot,
    username: normalized.adminUser,
    passwordHash
  });

  const legacyAdminEmail = `${normalized.adminUser}@nimb.local`;
  const existingAdmin = await runtime?.auth?.findUserByEmail?.(legacyAdminEmail);
  if (!existingAdmin) {
    await runtime?.auth?.createUser?.({
      username: 'admin',
      email: legacyAdminEmail,
      password: normalized.adminPassword
    });
  } else {
    await runtime?.auth?.updateAdminCredentials?.({
      email: legacyAdminEmail,
      password: normalized.adminPassword
    });
  }

  try {
    await runtime?.settings?.set?.('site.name', normalized.siteTitle);
  } catch {
    // Settings persistence may be unavailable in installer-only mode.
  }
  writeInstallLock({ projectRoot });

  runtime.system = Object.freeze({
    config: installState,
    installed: true
  });

  try {
    await bootstrapDefaultSite(projectPaths);
  } catch {
    // Installer should succeed even when optional default-site seeding is unavailable.
  }
  try {
    await runtime?.events?.emit?.('system.installed', { version: installState.version, installedAt: installState.installedAt });
  } catch {
    // Optional lifecycle listeners should not block base installation flow.
  }

  return {
    success: true,
    data: {
      install: installState
    },
    meta: {}
  };
};
