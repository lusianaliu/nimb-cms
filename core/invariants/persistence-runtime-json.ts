import { SHARED_STARTUP_PREFLIGHT_INVARIANTS } from './startup-preflight-invariants.ts';

export const PERSISTENCE_RUNTIME_JSON_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceRuntimeJson;

export const formatPersistenceRuntimeJsonInvariantFailure = (detail: string) =>
  `Startup invariant failed [${PERSISTENCE_RUNTIME_JSON_INVARIANT.id}]: ${detail}`;
