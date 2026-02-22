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

    if (manifest.exportedEvents !== undefined) {
      if (!Array.isArray(manifest.exportedEvents) || manifest.exportedEvents.some((eventName) => typeof eventName !== 'string' || eventName.trim().length === 0)) {
        throw new Error('manifest.exportedEvents must be a string array when provided');
      }
    }

    if (manifest.exportedCapabilities !== undefined) {
      if (!isRecord(manifest.exportedCapabilities)) {
        throw new Error('manifest.exportedCapabilities must be an object when provided');
      }

      for (const [capability, implementation] of Object.entries(manifest.exportedCapabilities)) {
        requireString(capability, 'exportedCapabilities key');
        if (typeof implementation !== 'function') {
          throw new Error(`manifest.exportedCapabilities.${capability} must be a function`);
        }
      }
    }

    if (manifest.providedCapabilities !== undefined) {
      if (!isRecord(manifest.providedCapabilities)) {
        throw new Error('manifest.providedCapabilities must be an object when provided');
      }

      for (const [capability, declaration] of Object.entries(manifest.providedCapabilities)) {
        requireString(capability, 'providedCapabilities key');
        if (!isRecord(declaration)) {
          throw new Error(`manifest.providedCapabilities.${capability} must be an object`);
        }

        requireString(declaration.version, `providedCapabilities.${capability}.version`);
      }
    }

    if (manifest.consumedCapabilities !== undefined) {
      const isLegacyArray = Array.isArray(manifest.consumedCapabilities);
      if (!isLegacyArray && !isRecord(manifest.consumedCapabilities)) {
        throw new Error('manifest.consumedCapabilities must be a string array or object map when provided');
      }

      if (isLegacyArray && manifest.consumedCapabilities.some((capability) => typeof capability !== 'string' || capability.trim().length === 0)) {
        throw new Error('manifest.consumedCapabilities array values must be non-empty strings');
      }

      if (!isLegacyArray) {
        for (const [capability, declaration] of Object.entries(manifest.consumedCapabilities)) {
          requireString(capability, 'consumedCapabilities key');
          if (!isRecord(declaration)) {
            throw new Error(`manifest.consumedCapabilities.${capability} must be an object`);
          }

          requireString(declaration.range, `consumedCapabilities.${capability}.range`);
        }
      }
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
      exportedEvents: manifest.exportedEvents
        ? [...new Set(manifest.exportedEvents)].sort()
        : [],
      exportedCapabilities: manifest.exportedCapabilities
        ? { ...manifest.exportedCapabilities }
        : {},
      providedCapabilities: Object.fromEntries(
        Object.entries(manifest.providedCapabilities ?? {}).map(([capability, declaration]) => [
          capability,
          { version: declaration.version.trim() }
        ])
      ),
      consumedCapabilities: Array.isArray(manifest.consumedCapabilities)
        ? Object.fromEntries([...new Set(manifest.consumedCapabilities)].sort().map((capability) => [capability, { range: '*' }]))
        : Object.fromEntries(
          Object.entries(manifest.consumedCapabilities ?? {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([capability, declaration]) => [capability, { range: declaration.range.trim() }])
        ),
      requiredPlatformContracts: { ...manifest.requiredPlatformContracts }
    };
  }
}
