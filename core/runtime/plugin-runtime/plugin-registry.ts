import { PluginState } from './runtime-types.ts';

export class PluginRegistry {
  constructor() {
    this.records = new Map();
    this.capabilityProviders = new Map();
    this.versionResolutions = new Map();
  }

  registerDescriptor(descriptor) {
    this.records.set(descriptor.id, {
      descriptor,
      manifest: null,
      state: PluginState.DISCOVERED,
      disposer: null,
      error: null
    });
  }

  setValidated(pluginId, manifest) {
    const record = this.require(pluginId);
    record.manifest = manifest;
    record.state = PluginState.VALIDATED;
    record.error = null;

    this.bindManifestCapabilities(pluginId, manifest);
  }

  setActive(pluginId, disposer) {
    const record = this.require(pluginId);
    record.disposer = disposer;
    record.state = PluginState.ACTIVE;
    record.error = null;
  }

  setFailed(pluginId, error) {
    const record = this.require(pluginId);
    record.state = PluginState.FAILED;
    record.error = error;
    record.disposer = null;
    this.unbindCapabilities(pluginId);
    this.clearConsumerResolutions(pluginId);
  }

  setDiscovered(pluginId) {
    const record = this.require(pluginId);
    record.state = PluginState.DISCOVERED;
    record.manifest = null;
    record.disposer = null;
    record.error = null;

    this.unbindCapabilities(pluginId);
    this.clearConsumerResolutions(pluginId);
  }

  get(pluginId) {
    return this.records.get(pluginId) ?? null;
  }

  list() {
    return Array.from(this.records.values())
      .sort((left, right) => left.descriptor.id.localeCompare(right.descriptor.id))
      .map((record) => ({
        id: record.descriptor.id,
        directory: record.descriptor.directory,
        manifestPath: record.descriptor.manifestPath,
        state: record.state,
        error: record.error
      }));
  }

  ids() {
    return Array.from(this.records.keys()).sort();
  }

  require(pluginId) {
    const record = this.records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }

    return record;
  }

  setVersionResolutions(resolutions) {
    this.versionResolutions.clear();
    for (const resolution of resolutions) {
      this.versionResolutions.set(`${resolution.consumerId}:${resolution.capability}`, {
        providerId: resolution.providerId,
        version: resolution.version
      });
    }
  }

  resolveCapabilityProvider(capabilityName, consumerId = null) {
    if (consumerId) {
      const explicit = this.versionResolutions.get(`${consumerId}:${capabilityName}`);
      if (explicit) {
        return explicit.providerId;
      }
    }

    const providers = this.capabilityProviders.get(capabilityName) ?? [];
    return providers[0] ?? null;
  }

  bindManifestCapabilities(pluginId, manifest) {
    this.unbindCapabilities(pluginId);

    for (const capabilityName of Object.keys(manifest.exportedCapabilities ?? {})) {
      if (!this.capabilityProviders.has(capabilityName)) {
        this.capabilityProviders.set(capabilityName, []);
      }

      this.capabilityProviders.get(capabilityName).push(pluginId);
      this.capabilityProviders.get(capabilityName).sort((left, right) => left.localeCompare(right));
    }
  }

  clearConsumerResolutions(pluginId) {
    for (const key of Array.from(this.versionResolutions.keys())) {
      if (key.startsWith(`${pluginId}:`)) {
        this.versionResolutions.delete(key);
      }
    }
  }

  unbindCapabilities(pluginId) {
    for (const [capabilityName, providers] of Array.from(this.capabilityProviders.entries())) {
      const filtered = providers.filter((providerId) => providerId !== pluginId);
      if (filtered.length === 0) {
        this.capabilityProviders.delete(capabilityName);
      } else {
        this.capabilityProviders.set(capabilityName, filtered);
      }
    }
  }
}
