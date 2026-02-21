import { PluginState } from './runtime-types.ts';

export class PluginRegistry {
  constructor() {
    this.records = new Map();
    this.capabilityProviders = new Map();
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
  }

  setDiscovered(pluginId) {
    const record = this.require(pluginId);
    record.state = PluginState.DISCOVERED;
    record.manifest = null;
    record.disposer = null;
    record.error = null;

    this.unbindCapabilities(pluginId);
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

  resolveCapabilityProvider(capabilityName) {
    return this.capabilityProviders.get(capabilityName) ?? null;
  }

  bindManifestCapabilities(pluginId, manifest) {
    this.unbindCapabilities(pluginId);

    for (const capabilityName of Object.keys(manifest.exportedCapabilities ?? {})) {
      const existingProvider = this.capabilityProviders.get(capabilityName);
      if (existingProvider && existingProvider !== pluginId) {
        throw new Error(
          `duplicate capability provider for "${capabilityName}": ${existingProvider} and ${pluginId}`
        );
      }

      this.capabilityProviders.set(capabilityName, pluginId);
    }
  }

  unbindCapabilities(pluginId) {
    for (const [capabilityName, providerId] of Array.from(this.capabilityProviders.entries())) {
      if (providerId === pluginId) {
        this.capabilityProviders.delete(capabilityName);
      }
    }
  }
}
