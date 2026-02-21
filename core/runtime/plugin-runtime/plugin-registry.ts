import { PluginState } from './runtime-types.ts';

export class PluginRegistry {
  constructor() {
    this.records = new Map();
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
  }

  setDiscovered(pluginId) {
    const record = this.require(pluginId);
    record.state = PluginState.DISCOVERED;
    record.manifest = null;
    record.disposer = null;
    record.error = null;
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
}
