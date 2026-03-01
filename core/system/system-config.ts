import fs from 'node:fs';
import path from 'node:path';
import { version } from '../runtime/version.ts';

const SYSTEM_CONFIG_RELATIVE_PATH = path.join('data', 'system', 'config.json');

const resolveConfigPath = (projectRoot = process.cwd()) => path.join(projectRoot, SYSTEM_CONFIG_RELATIVE_PATH);

const createDefaultConfig = (runtimeVersion = version) => Object.freeze({
  installed: false,
  version: runtimeVersion,
  installedAt: null
});

type SystemConfig = {
  installed: boolean
  version: string
  installedAt: string | null
};

export const loadSystemConfig = ({ projectRoot = process.cwd(), runtimeVersion = version }: { projectRoot?: string, runtimeVersion?: string } = {}): SystemConfig => {
  const configPath = resolveConfigPath(projectRoot);

  if (!fs.existsSync(configPath)) {
    return createDefaultConfig(runtimeVersion);
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return Object.freeze({
      installed: raw?.installed === true,
      version: String(raw?.version ?? runtimeVersion),
      installedAt: typeof raw?.installedAt === 'string' ? raw.installedAt : null
    });
  } catch {
    return createDefaultConfig(runtimeVersion);
  }
};

export const saveSystemConfig = (config: Partial<SystemConfig>, { projectRoot = process.cwd() }: { projectRoot?: string } = {}): SystemConfig => {
  const configPath = resolveConfigPath(projectRoot);
  const normalized: SystemConfig = Object.freeze({
    installed: config?.installed === true,
    version: String(config?.version ?? version),
    installedAt: typeof config?.installedAt === 'string' ? config.installedAt : null
  });

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
};

export const getInstallState = ({ projectRoot = process.cwd(), runtimeVersion = version }: { projectRoot?: string, runtimeVersion?: string } = {}) => {
  const config = loadSystemConfig({ projectRoot, runtimeVersion });

  return Object.freeze({
    installed: config.installed === true,
    config
  });
};

