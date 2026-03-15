import type { SharedInvariantDefinition } from './startup-preflight-invariants.ts';

export const formatDirectoryWritabilityInvariantFailure = (invariant: SharedInvariantDefinition, detail: string) =>
  `Startup invariant failed [${invariant.id}]: ${detail}`;

export const formatDirectoryShapeInvariantFailure = (invariant: SharedInvariantDefinition, label: string, directoryPath: string) =>
  formatDirectoryWritabilityInvariantFailure(invariant, `${label} path is not a directory: ${directoryPath}`);
