import type { SharedInvariantDefinition } from './startup-preflight-invariants.ts';

export const formatDirectoryWritabilityInvariantFailure = (invariant: SharedInvariantDefinition, detail: string) =>
  `Startup invariant failed [${invariant.id}]: ${detail}`;
