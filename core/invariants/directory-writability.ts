import fs from 'node:fs';
import path from 'node:path';
import type { SharedInvariantDefinition } from './startup-preflight-invariants.ts';

export const formatDirectoryWritabilityInvariantFailure = (invariant: SharedInvariantDefinition, detail: string) =>
  `Startup invariant failed [${invariant.id}]: ${detail}`;

export const formatDirectoryShapeInvariantFailure = (invariant: SharedInvariantDefinition, label: string, directoryPath: string) =>
  formatDirectoryWritabilityInvariantFailure(invariant, `${label} path is not a directory: ${directoryPath}`);

export const resolveNearestExistingPath = (targetPath: string) => {
  let currentPath = path.resolve(targetPath);
  while (!fs.existsSync(currentPath)) {
    const nextPath = path.dirname(currentPath);
    if (nextPath === currentPath) {
      return null;
    }

    currentPath = nextPath;
  }

  return currentPath;
};

export const formatDirectoryParentNotWritableDetail = (directoryPath: string, nearestExistingPath: string) =>
  `${directoryPath} is missing and parent path ${nearestExistingPath} is not writable.`;

export const formatDirectoryUnresolvedParentDetail = (directoryPath: string) =>
  `Unable to resolve an existing parent path for ${directoryPath}.`;

export const formatDirectoryMissingWithWritableParentDetail = (directoryPath: string, nearestExistingPath: string) =>
  `${directoryPath} is missing, but parent path ${nearestExistingPath} appears writable so startup can create it.`;

export const formatDirectoryNextPathSuffix = (directoryPath: string) => `(Path: ${directoryPath})`;


export const formatDirectoryParentNotWritableInvariantFailure = (
  invariant: SharedInvariantDefinition,
  directoryPath: string,
  nearestExistingPath: string
) => formatDirectoryWritabilityInvariantFailure(invariant, formatDirectoryParentNotWritableDetail(directoryPath, nearestExistingPath));

export const formatDirectoryUnresolvedParentInvariantFailure = (invariant: SharedInvariantDefinition, directoryPath: string) =>
  formatDirectoryWritabilityInvariantFailure(invariant, formatDirectoryUnresolvedParentDetail(directoryPath));
