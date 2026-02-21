import { CapabilityResolver } from '../capability-resolver/capability-resolver.ts';
import { ManifestValidator } from './manifest-validator.ts';
import { PluginLoader } from './plugin-loader.ts';
import { PluginRegistry } from './plugin-registry.ts';
import { PluginState, RuntimeEvent, createStructuredError } from './runtime-types.ts';

const noopDisposer = () => {};

export class PluginRuntime {
  constructor(options = {}) {
    this.logger = options.logger;
    this.contracts = options.contracts ?? {};
    this.loader = options.loader ?? new PluginLoader({
      pluginsDirectory: options.pluginsDirectory,
      logger: options.logger
    });
    this.validator = options.validator ?? new ManifestValidator();
    this.registry = options.registry ?? new PluginRegistry();
    this.capabilityResolver = options.capabilityResolver ?? new CapabilityResolver({
      registry: this.registry,
      logger: this.logger
    });
  }

  async start() {
    const descriptors = await this.loader.discover();

    for (const descriptor of descriptors) {
      await this.runLifecycle(descriptor);
    }

    return this.registry.list();
  }

  async runLifecycle(descriptor) {
    this.registry.registerDescriptor(descriptor);
    this.logger?.info?.(RuntimeEvent.DISCOVER, { plugin: descriptor.id, manifestPath: descriptor.manifestPath });

    try {
      const manifestData = await this.loader.loadManifest(descriptor);
      const manifest = this.validator.validate(manifestData, descriptor);
      this.registry.setValidated(descriptor.id, manifest);
      this.logger?.info?.(RuntimeEvent.VALIDATE, {
        plugin: manifest.id,
        version: manifest.version,
        capabilities: manifest.declaredCapabilities.length
      });

      for (const [capabilityName, interfaceFactory] of Object.entries(manifest.exportedCapabilities ?? {})) {
        this.capabilityResolver.bindProvider(descriptor.id, capabilityName, interfaceFactory);
      }

      const register = await this.loader.loadRegisterEntrypoint(descriptor, manifest);
      this.logger?.info?.(RuntimeEvent.REGISTER, { plugin: manifest.id });

      const runtimeContext = this.capabilityResolver.createConsumer(descriptor.id);
      const runtimeContracts = {
        ...this.contracts,
        useCapability: runtimeContext.useCapability
      };

      const disposer = await Promise.resolve(register(runtimeContracts));
      if (disposer !== undefined && typeof disposer !== 'function') {
        throw new Error('register entrypoint must return a disposer function when provided');
      }

      this.registry.setActive(descriptor.id, disposer ?? noopDisposer);
      this.logger?.info?.(RuntimeEvent.ACTIVATE, { plugin: manifest.id });
    } catch (error) {
      this.capabilityResolver.unbindProvider(descriptor.id);
      this.registry.setFailed(descriptor.id, createStructuredError(error));
      this.logger?.error?.(RuntimeEvent.FAILURE, {
        plugin: descriptor.id,
        stage: 'start',
        error: createStructuredError(error)
      });
    }
  }

  async unload(pluginId) {
    const record = this.registry.get(pluginId);
    if (!record || record.state !== PluginState.ACTIVE) {
      return false;
    }

    try {
      await Promise.resolve(record.disposer());
      this.capabilityResolver.unbindProvider(pluginId);
      this.registry.setDiscovered(pluginId);
      this.logger?.info?.(RuntimeEvent.UNLOAD, { plugin: pluginId });
      return true;
    } catch (error) {
      this.registry.setFailed(pluginId, createStructuredError(error));
      this.logger?.error?.(RuntimeEvent.FAILURE, {
        plugin: pluginId,
        stage: 'unload',
        error: createStructuredError(error)
      });
      return false;
    }
  }

  async unloadAll() {
    const activePluginIds = this.registry
      .ids()
      .filter((pluginId) => this.registry.get(pluginId)?.state === PluginState.ACTIVE)
      .reverse();

    for (const pluginId of activePluginIds) {
      await this.unload(pluginId);
    }
  }
}
