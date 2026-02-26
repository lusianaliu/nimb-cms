import fs from 'node:fs';
import path from 'node:path';

const INSTALL_STATE_PATH = '/data/system/install.json';

export const isInstalled = (): boolean => fs.existsSync(INSTALL_STATE_PATH);

export const markInstalled = (metadata: { version?: string } = {}) => {
  const installStateDirectory = path.dirname(INSTALL_STATE_PATH);
  fs.mkdirSync(installStateDirectory, { recursive: true });

  const installState = {
    installedAt: new Date().toISOString(),
    version: String(metadata.version ?? '0.0.0')
  };

  fs.writeFileSync(INSTALL_STATE_PATH, `${JSON.stringify(installState, null, 2)}\n`, 'utf8');
  return installState;
};
