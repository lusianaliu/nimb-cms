import fs from 'node:fs';
import path from 'node:path';

export const INSTALL_STATE_FILENAME = 'install.json';

export type InstallState = {
  installed: boolean;
  version: string;
  installedAt: string;
};

const resolveNimbDirectory = (projectModel) => projectModel?.persistenceDir ?? projectModel?.persistenceDirectory;

const isValidInstallState = (value: unknown): value is InstallState => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const state = value as Record<string, unknown>;
  return state.installed === true && typeof state.version === 'string' && typeof state.installedAt === 'string';
};

export const readInstallState = (projectModel): InstallState | null => {
  const nimbDir = resolveNimbDirectory(projectModel);
  if (typeof nimbDir !== 'string' || nimbDir.trim() === '') {
    return null;
  }

  const installStatePath = path.join(nimbDir, INSTALL_STATE_FILENAME);

  try {
    if (!fs.existsSync(installStatePath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(installStatePath, 'utf8'));
    return isValidInstallState(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
};

export const isProjectInstalled = (projectModel): boolean => readInstallState(projectModel) !== null;
