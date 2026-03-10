import { saveSystemConfig } from '../../core/system/system-config.ts';
import { writeInstallLock } from '../../core/installer/install-lock.ts';

type RuntimeLike = {
  version: string
  projectPaths?: { projectRoot?: string }
  system?: { installed?: boolean, config?: unknown }
  setRuntimeMode?: (mode: 'normal' | 'installer') => void
  auth?: {
    findUserByEmail?: (email: string) => Promise<Record<string, unknown> | null>
    createUser?: (input: unknown) => Promise<Record<string, unknown> | null>
    updateAdminCredentials?: (input: { email: string, password: string }) => Promise<Record<string, unknown> | null>
  }
};

export async function ensureInstalled(runtime: RuntimeLike) {
  await saveSystemConfig({
    installed: true,
    version: runtime.version,
    installedAt: new Date().toISOString()
  }, {
    projectRoot: runtime.projectPaths?.projectRoot
  });

  writeInstallLock({ projectRoot: runtime.projectPaths?.projectRoot });

  runtime.system = {
    ...(runtime.system ?? {}),
    installed: true
  };
  runtime.setRuntimeMode?.('normal');

  const adminEmail = 'admin@nimb.local';
  const existingAdmin = await runtime?.auth?.findUserByEmail?.(adminEmail);
  if (!existingAdmin) {
    await runtime?.auth?.createUser?.({
      username: 'admin',
      email: adminEmail,
      password: 'admin'
    });
    return;
  }

  await runtime?.auth?.updateAdminCredentials?.({
    email: adminEmail,
    password: 'admin'
  });
}

export const ensureInstalledSystem = ensureInstalled;
