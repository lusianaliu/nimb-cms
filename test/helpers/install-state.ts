import { saveSystemConfig } from '../../core/system/system-config.ts';

type RuntimeLike = {
  version: string
  projectPaths?: { projectRoot?: string }
  system?: { installed?: boolean, config?: unknown }
};

export async function ensureInstalled(runtime: RuntimeLike) {
  await saveSystemConfig({
    installed: true,
    version: runtime.version,
    installedAt: new Date().toISOString()
  }, {
    projectRoot: runtime.projectPaths?.projectRoot
  });

  runtime.system = {
    ...(runtime.system ?? {}),
    installed: true
  };
}

export const ensureInstalledSystem = ensureInstalled;
