import { SHARED_STARTUP_PREFLIGHT_INVARIANTS } from './startup-preflight-invariants.ts';

export const STARTUP_PORT_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.startupPort;

export const formatStartupPortInvariantFailure = (detail: string) => `Startup invariant failed [${STARTUP_PORT_INVARIANT.id}]: ${detail}`;

export const assertValidStartupPort = (port: unknown, sourceLabel: string) => {
  if (!Number.isInteger(port) || Number(port) < 0 || Number(port) > 65535) {
    throw new Error(formatStartupPortInvariantFailure(`invalid ${sourceLabel}: ${String(port)}`));
  }

  return Number(port);
};
