import { CapabilityVersion } from '../runtime/versioning/capability-version.ts';
import { VersionRange } from '../runtime/versioning/version-range.ts';

export const isCompatible = (coreVersion: string, pluginRange: string): boolean => {
  const version = CapabilityVersion.parse(coreVersion);
  const range = VersionRange.parse(pluginRange);
  return VersionRange.includes(range, version);
};
