import { SHARED_STARTUP_PREFLIGHT_INVARIANTS } from './startup-preflight-invariants.ts';

export const ADMIN_STATIC_DIR_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.adminStaticDir;

export const formatAdminStaticDirInvariantFailure = (detail: string) =>
  `Startup invariant failed [${ADMIN_STATIC_DIR_INVARIANT.id}]: ${detail}`;
