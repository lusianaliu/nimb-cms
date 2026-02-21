import { isRecord } from './runtime-types.ts';

const requireString = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`manifest field "${field}" must be a non-empty string`);
  }
};

export class ManifestValidator {
  validate(manifest, descriptor) {
    if (!isRecord(manifest)) {
      throw new Error('manifest export must be an object');
    }

    const name = manifest.name ?? manifest.displayName ?? manifest.id;
    requireString(name, 'name');
    requireString(manifest.version, 'version');

    if (!isRecord(manifest.entrypoints)) {
      throw new Error('manifest.entrypoints must be an object');
    }

    requireString(manifest.entrypoints.register, 'entrypoints.register');

    if (!Array.isArray(manifest.declaredCapabilities) || manifest.declaredCapabilities.some((capability) => typeof capability !== 'string')) {
      throw new Error('manifest.declaredCapabilities must be a string array');
    }

    if (!isRecord(manifest.requiredPlatformContracts)) {
      throw new Error('manifest.requiredPlatformContracts must be an object');
    }

    const requiredContracts = Object.entries(manifest.requiredPlatformContracts);
    if (requiredContracts.length === 0) {
      throw new Error('manifest.requiredPlatformContracts must declare at least one contract');
    }

    for (const [contractName, versionRange] of requiredContracts) {
      requireString(contractName, 'requiredPlatformContracts key');
      requireString(versionRange, `requiredPlatformContracts.${contractName}`);
    }

    return {
      id: manifest.id ?? descriptor.id,
      name,
      version: manifest.version,
      entrypoints: {
        register: manifest.entrypoints.register
      },
      declaredCapabilities: [...manifest.declaredCapabilities],
      requiredPlatformContracts: { ...manifest.requiredPlatformContracts }
    };
  }
}
