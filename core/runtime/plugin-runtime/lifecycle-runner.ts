import { CapabilityResolver } from '../capability-resolver/capability-resolver.ts';
import { EventSystem } from '../event-system/event-system.ts';
import { ManifestValidator } from './manifest-validator.ts';
import { RuntimeStateStore } from '../state-store/state-store.ts';
import { PluginLoader } from './plugin-loader.ts';
import { DiagnosticsChannel, RuntimeInspector, EventTrace, CapabilityTrace, StateTrace } from '../observability/index.ts';
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
    this.diagnosticsChannel = options.diagnosticsChannel ?? new DiagnosticsChannel();
    this.eventTrace = options.eventTrace ?? new EventTrace({ diagnosticsChannel: this.diagnosticsChannel });
    this.capabilityTrace = options.capabilityTrace ?? new CapabilityTrace({ diagnosticsChannel: this.diagnosticsChannel });
    this.stateTrace = options.stateTrace ?? new StateTrace({ diagnosticsChannel: this.diagnosticsChannel });
    this.registry = options.registry ?? new PluginRegistry();
    this.capabilityResolver = options.capabilityResolver ?? new CapabilityResolver({
      registry: this.registry,
      logger: this.logger,
      capabilityTrace: this.capabilityTrace
    });
    this.eventSystem = options.eventSystem ?? new EventSystem({
      logger: this.logger,
      eventTrace: this.eventTrace
    });
    this.stateStore = options.stateStore ?? new RuntimeStateStore({
      logger: this.logger,
      eventSystem: this.eventSystem,
      stateTrace: this.stateTrace
    });
    this.inspector = options.inspector ?? new RuntimeInspector({
      registry: this.registry,
      eventTrace: this.eventTrace,
      capabilityTrace: this.capabilityTrace,
      stateTrace: this.stateTrace,
      diagnosticsChannel: this.diagnosticsChannel
    });
  }

  getInspector() {
    return this.inspector;
  }

  async start() {
    const descriptors = await this.loader.discover();

    for (const [index, descriptor] of descriptors.entries()) {
      await this.runLifecycle(descriptor, index);
    }

    return this.registry.list();
  }

  async runLifecycle(descriptor, loadOrder = 0) {
    this.registry.registerDescriptor(descriptor);
    this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.discover', { plugin: descriptor.id, loadOrder });
    this.logger?.info?.(RuntimeEvent.DISCOVER, { plugin: descriptor.id, manifestPath: descriptor.manifestPath });

    try {
      const manifestData = await this.loader.loadManifest(descriptor);
      const manifest = this.validator.validate(manifestData, descriptor);
      this.registry.setValidated(descriptor.id, manifest);
      this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.validate', { plugin: descriptor.id });
      this.logger?.info?.(RuntimeEvent.VALIDATE, {
        plugin: manifest.id,
        version: manifest.version,
        capabilities: manifest.declaredCapabilities.length
      });

      this.eventSystem.registerPlugin(descriptor.id, manifest.exportedEvents, loadOrder);

      for (const [capabilityName, interfaceFactory] of Object.entries(manifest.exportedCapabilities ?? {})) {
        this.capabilityResolver.bindProvider(descriptor.id, capabilityName, interfaceFactory);
      }

      const register = await this.loader.loadRegisterEntrypoint(descriptor, manifest);
      this.logger?.info?.(RuntimeEvent.REGISTER, { plugin: manifest.id });

      const runtimeContext = this.capabilityResolver.createConsumer(descriptor.id);
      const runtimeContracts = {
        ...this.contracts,
        useCapability: runtimeContext.useCapability,
        emit: (eventName, payload) => this.eventSystem.emit(descriptor.id, eventName, payload),
        on: (eventName, handler) => this.eventSystem.on(descriptor.id, eventName, handler),
        state: {
          define: (name, initialValue) => this.stateStore.define(descriptor.id, name, initialValue),
          update: (name, updater) => this.stateStore.update(descriptor.id, name, updater),
          get: (name) => this.stateStore.get(descriptor.id, name),
          subscribe: (name, handler) => this.stateStore.subscribe(descriptor.id, name, handler)
        }
      };

      const disposer = await Promise.resolve(register(runtimeContracts));
      if (disposer !== undefined && typeof disposer !== 'function') {
        throw new Error('register entrypoint must return a disposer function when provided');
      }

      this.registry.setActive(descriptor.id, disposer ?? noopDisposer);
      this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.activate', { plugin: descriptor.id });
      this.logger?.info?.(RuntimeEvent.ACTIVATE, { plugin: manifest.id });
    } catch (error) {
      this.stateStore.unloadPlugin(descriptor.id);
      this.eventSystem.unregisterPlugin(descriptor.id);
      this.capabilityResolver.unbindProvider(descriptor.id);
      this.registry.setFailed(descriptor.id, createStructuredError(error));
      this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.failure', { plugin: descriptor.id, stage: 'start' });
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
      this.stateStore.unloadPlugin(pluginId);
      this.eventSystem.unregisterPlugin(pluginId);
      this.capabilityResolver.unbindProvider(pluginId);
      this.registry.setDiscovered(pluginId);
      this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.unload', { plugin: pluginId, result: 'success' });
      this.logger?.info?.(RuntimeEvent.UNLOAD, { plugin: pluginId });
      return true;
    } catch (error) {
      this.stateStore.unloadPlugin(pluginId);
      this.eventSystem.unregisterPlugin(pluginId);
      this.capabilityResolver.unbindProvider(pluginId);
      this.registry.setFailed(pluginId, createStructuredError(error));
      this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.unload', { plugin: pluginId, result: 'failure' });
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
