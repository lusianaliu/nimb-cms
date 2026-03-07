import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { saveSystemConfig } from '../system/system-config.ts';
import { bootstrapDefaultSite } from './bootstrap-default-site.ts';

const resolveProjectPaths = (runtime) => runtime?.projectPaths ?? runtime?.project ?? null;
const INSTALL_STATE_PATH = path.resolve('/data/system/install.json');

const writeInstallStateFile = async (installedAt: string) => {
  await fs.mkdir(path.dirname(INSTALL_STATE_PATH), { recursive: true });
  const payload = Object.freeze({
    installed: true,
    installedAt
  });

  await fs.writeFile(INSTALL_STATE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

export const handleInstall = async (_request, runtime) => {
  const projectPaths = resolveProjectPaths(runtime);
  const projectRoot = projectPaths?.projectRoot;

  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') {
    return { success: false, error: { code: 'INSTALL_PATH_UNAVAILABLE', message: 'Project path is unavailable' } };
  }

  if (runtime?.system?.installed === true) {
    return { success: false, error: { code: 'ALREADY_INSTALLED', message: 'Project is already installed' } };
  }

  const installedAt = new Date().toISOString();
  const installState = saveSystemConfig({
    installed: true,
    installedAt,
    version: runtime?.version ?? 'dev'
  }, { projectRoot });

  const bootstrapPassword = crypto.randomBytes(12).toString('base64');
  const existingAdmin = await runtime?.auth?.findUserByEmail?.('admin@nimb.local');
  const adminUser = existingAdmin ?? await runtime?.auth?.createUser?.({
    username: 'admin',
    email: 'admin@nimb.local',
    password: bootstrapPassword,
    requirePasswordChange: true
  });

  const bootstrapSession = adminUser?.id
    ? await runtime?.sessions?.createSession?.(adminUser.id)
    : null;

  runtime.system = Object.freeze({
    config: installState,
    installed: true
  });

  await writeInstallStateFile(installedAt);
  await bootstrapDefaultSite(projectPaths);
  await runtime?.events?.emit?.('system.installed', { version: installState.version, installedAt: installState.installedAt });
  process.stdout.write('installation completed\n');

  return {
    success: true,
    data: {
      install: installState,
      setupRequired: true,
      session: bootstrapSession ? { id: bootstrapSession.id } : null
    },
    meta: {}
  };
};
