import fs from 'node:fs';
import path from 'node:path';
import { jsonResponse } from '../http/response.ts';
import { INSTALL_STATE_FILENAME, readInstallState } from '../project/install-state.ts';
import { bootstrapDefaultSite } from './bootstrap-default-site.ts';

const resolveProjectPaths = (runtime) => runtime?.projectPaths ?? runtime?.project ?? null;

export const handleInstall = async (_request, runtime) => {
  if (runtime?.getRuntimeMode?.() !== 'installer') {
    return jsonResponse({ success: false, error: { code: 'INSTALLER_MODE_REQUIRED', message: 'Installer API is only available in installer mode' } }, { statusCode: 409 });
  }

  const projectPaths = resolveProjectPaths(runtime);
  const persistenceDir = projectPaths?.persistenceDir;

  if (typeof persistenceDir !== 'string' || persistenceDir.trim() === '') {
    return jsonResponse({ success: false, error: { code: 'INSTALL_PATH_UNAVAILABLE', message: 'Project persistence path is unavailable' } }, { statusCode: 500 });
  }

  if (readInstallState(projectPaths)) {
    return jsonResponse({ success: false, error: { code: 'ALREADY_INSTALLED', message: 'Project is already installed' } }, { statusCode: 409 });
  }

  const installState = Object.freeze({
    installed: true,
    installedAt: new Date().toISOString(),
    version: runtime?.version ?? 'dev'
  });

  fs.mkdirSync(persistenceDir, { recursive: true });
  fs.writeFileSync(path.join(persistenceDir, INSTALL_STATE_FILENAME), `${JSON.stringify(installState, null, 2)}\n`);
  await bootstrapDefaultSite(projectPaths);
  process.stdout.write('installation completed\n');

  return jsonResponse({ success: true, data: { install: installState }, meta: {} }, { statusCode: 200 });
};
