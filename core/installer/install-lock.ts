import fs from 'node:fs';
import path from 'node:path';

const INSTALL_LOCK_RELATIVE_PATH = path.join('data', 'install.lock');

const resolveInstallLockPath = (projectRoot = process.cwd()) => path.join(projectRoot, INSTALL_LOCK_RELATIVE_PATH);

export const hasInstallLock = ({ projectRoot = process.cwd() }: { projectRoot?: string } = {}) => fs.existsSync(resolveInstallLockPath(projectRoot));

export const writeInstallLock = ({ projectRoot = process.cwd() }: { projectRoot?: string } = {}) => {
  const lockPath = resolveInstallLockPath(projectRoot);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, 'installed\n', 'utf8');
  return lockPath;
};
