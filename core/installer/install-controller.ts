import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isSystemInstalled, saveSystemConfig } from '../system/system-config.ts';
import { bootstrapDefaultSite } from './bootstrap-default-site.ts';
import { hasInstallLock, writeInstallLock } from './install-lock.ts';

const resolveProjectPaths = (runtime) => runtime?.projectPaths ?? runtime?.project ?? null;

type InstallInput = {
  siteTitle: string
  adminUser: string
  adminPassword: string
  adminPasswordConfirm?: string
};

const ADMIN_STATE_RELATIVE_PATH = path.join('data', 'system', 'admin.json');

const normalizeInput = (input: Partial<InstallInput> = {}): InstallInput => Object.freeze({
  siteTitle: `${input.siteTitle ?? ''}`.trim(),
  adminUser: `${input.adminUser ?? ''}`.trim(),
  adminPassword: `${input.adminPassword ?? ''}`,
  adminPasswordConfirm: typeof input.adminPasswordConfirm === 'string' ? input.adminPasswordConfirm : undefined
});

const SITE_TITLE_MAX_LENGTH = 120;
const ADMIN_USER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/;

const validateInput = (input: InstallInput) => {
  if (input.siteTitle.length < 2) {
    return 'Please enter a site title with at least 2 characters.';
  }

  if (input.siteTitle.length > SITE_TITLE_MAX_LENGTH) {
    return `Site title must be ${SITE_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  if (!ADMIN_USER_PATTERN.test(input.adminUser)) {
    return 'Admin username must be 3-32 characters and can use letters, numbers, dots, dashes, or underscores.';
  }

  if (input.adminPassword.length < 8) {
    return 'Please create an admin password with at least 8 characters.';
  }

  if (!/[a-zA-Z]/.test(input.adminPassword) || !/[0-9]/.test(input.adminPassword)) {
    return 'Use at least one letter and one number in the admin password.';
  }

  if (typeof input.adminPasswordConfirm === 'string' && input.adminPassword !== input.adminPasswordConfirm) {
    return 'Admin password confirmation does not match.';
  }

  return null;
};

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

  if (hasInstallLock({ projectRoot }) || isSystemInstalled({ projectRoot })) {
    return { success: false, error: { code: 'ALREADY_INSTALLED', message: 'Project is already installed' } };
  }

  const normalized = normalizeInput(input);
  const validationError = validateInput(normalized);
  if (validationError) {
    return { success: false, error: { code: 'INVALID_INSTALL_INPUT', message: validationError } };
  }

  let installState;
  try {
    const installedAt = new Date().toISOString();
    installState = saveSystemConfig({
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
  } catch (error) {
    runtime?.logger?.error?.('installer persistence failed', error);
    return {
      success: false,
      error: {
        code: 'INSTALL_PERSIST_FAILED',
        message: 'Nimb could not save install settings. Please check folder permissions and try again.'
      }
    };
  }

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
