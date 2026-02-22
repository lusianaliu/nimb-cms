import { CapabilityResolver } from '../capability-resolver/capability-resolver.ts';
import { EventSystem } from '../event-system/event-system.ts';
import { ManifestValidator } from './manifest-validator.ts';
import { RuntimeStateStore } from '../state-store/state-store.ts';
import { PluginLoader } from './plugin-loader.ts';
import { DiagnosticsChannel, RuntimeInspector, EventTrace, CapabilityTrace, StateTrace } from '../observability/index.ts';
import { PluginRegistry } from './plugin-registry.ts';
import { TopologyGraph, DependencyResolver, ActivationPlanner, TopologySnapshot } from '../topology/index.ts';
import { PluginState, RuntimeEvent, createStructuredError } from './runtime-types.ts';
import { HealthMonitor } from '../health/index.ts';
import { VersionResolver, CompatibilityChecker, VersionSnapshot } from '../versioning/index.ts';

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
    this.topologyGraph = options.topologyGraph ?? new TopologyGraph();
    this.dependencyResolver = options.dependencyResolver ?? new DependencyResolver({ allowDuplicateProviders: true });
    this.activationPlanner = options.activationPlanner ?? new ActivationPlanner();
    this.versionResolver = options.versionResolver ?? new VersionResolver();
    this.compatibilityChecker = options.compatibilityChecker ?? new CompatibilityChecker();
    this.activationCatalog = new Map();
    this.healthMonitor = options.healthMonitor ?? new HealthMonitor({
      diagnosticsChannel: this.diagnosticsChannel,
      recoveryHandlers: {
        retryActivation: async (pluginId) => this.retryActivation(pluginId),
        isolatePlugin: async (pluginId) => this.isolatePlugin(pluginId),
        disableCapabilityProvider: async (pluginId) => this.disableCapabilityProvider(pluginId),
        dependencyCascadeStop: async (pluginId) => this.dependencyCascadeStop(pluginId)
      }
    });
    this.capabilityResolver = options.capabilityResolver ?? new CapabilityResolver({
      registry: this.registry,
      logger: this.logger,
      capabilityTrace: this.capabilityTrace,
      healthReporter: (failure) => this.healthMonitor.recordFailure(failure)
    });
    this.eventSystem = options.eventSystem ?? new EventSystem({
      logger: this.logger,
      eventTrace: this.eventTrace,
      healthReporter: (failure) => this.healthMonitor.recordFailure(failure)
    });
    this.stateStore = options.stateStore ?? new RuntimeStateStore({
      logger: this.logger,
      eventSystem: this.eventSystem,
      stateTrace: this.stateTrace,
      healthReporter: (failure) => this.healthMonitor.recordFailure(failure)
    });
    this.lastActivationPlan = [];
    this.lastValidation = {
      unresolvedDependencies: [],
      duplicateProviders: [],
      cycles: []
    };
    this.lastVersionSnapshot = VersionSnapshot.from({
      resolutions: [],
      warnings: [],
      rejectedPlugins: []
    });
    this.inspector = options.inspector ?? new RuntimeInspector({
      registry: this.registry,
      eventTrace: this.eventTrace,
      capabilityTrace: this.capabilityTrace,
      stateTrace: this.stateTrace,
      diagnosticsChannel: this.diagnosticsChannel,
      topologyProvider: () => this.getTopologySnapshot(),
      healthProvider: () => this.healthMonitor.snapshot(),
      versionProvider: () => this.lastVersionSnapshot
    });
  }

  getInspector() {
    return this.inspector;
  }

  getTopologySnapshot() {
    return TopologySnapshot.from({
      graph: this.topologyGraph,
      activationOrder: this.lastActivationPlan,
      validation: this.lastValidation
    });
  }

  async start() {
    const descriptors = await this.loader.discover();
    const validated = [];

    for (const [index, descriptor] of descriptors.entries()) {
      this.registry.registerDescriptor(descriptor);
      this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.discover', { plugin: descriptor.id, loadOrder: index });
      this.logger?.info?.(RuntimeEvent.DISCOVER, { plugin: descriptor.id, manifestPath: descriptor.manifestPath });

      try {
        const manifestData = await this.loader.loadManifest(descriptor);
        const manifest = this.validator.validate(manifestData, descriptor);
        this.registry.setValidated(descriptor.id, manifest);
        this.topologyGraph.registerPlugin(descriptor.id, manifest, index);
        this.activationCatalog.set(descriptor.id, { descriptor, manifest, loadOrder: index });
        this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.validate', { plugin: descriptor.id });
        this.logger?.info?.(RuntimeEvent.VALIDATE, {
          plugin: manifest.id,
          version: manifest.version,
          capabilities: manifest.declaredCapabilities.length
        });

        validated.push({ descriptor, manifest, loadOrder: index });
      } catch (error) {
        this.registry.setFailed(descriptor.id, createStructuredError(error));
        this.topologyGraph.unregisterPlugin(descriptor.id);
        this.diagnosticsChannel.emit('plugin.runtime.diagnostics.lifecycle.failure', { plugin: descriptor.id, stage: 'validate' });
        this.logger?.error?.(RuntimeEvent.FAILURE, {
          plugin: descriptor.id,
          stage: 'validate',
          error: createStructuredError(error)
        });
      }
    }

    this.diagnosticsChannel.emit('plugin.runtime.diagnostics.topology:build', {
      nodes: this.topologyGraph.getNodes().length,
      edges: this.topologyGraph.getEdges().length
    });

    this.lastValidation = this.dependencyResolver.validate(this.topologyGraph);
    this.diagnosticsChannel.emit('plugin.runtime.diagnostics.topology:validated', {
      valid: this.lastValidation.valid,
      unresolved: this.lastValidation.unresolvedDependencies.length,
      duplicates: this.lastValidation.duplicateProviders.length,
      cycles: this.lastValidation.cycles.length
    });

    if (!this.lastValidation.valid) {
      const errors = [
        ...this.lastValidation.unresolvedDependencies.map((entry) => `${entry.pluginId} -> missing ${entry.capability}`),
        ...this.lastValidation.duplicateProviders.map((entry) => `${entry.pluginId} -> duplicate ${entry.capability}`),
        ...this.lastValidation.cycles.map((cycle) => `cycle: ${cycle.join(' -> ')}`)
      ];
      const error = new Error(`topology validation failed: ${errors.join('; ')}`);

      for (const item of validated) {
        this.registry.setFailed(item.descriptor.id, createStructuredError(error));
      }

      this.lastActivationPlan = [];
      this.lastVersionSnapshot = VersionSnapshot.from({ resolutions: [], warnings: [], rejectedPlugins: [] });
      this.diagnosticsChannel.emit('plugin.runtime.diagnostics.topology:activationPlan', { activationOrder: [] });
      return this.registry.list();
    }

    const versionResolution = this.versionResolver.resolve(this.topologyGraph);
    const compatibility = this.compatibilityChecker.evaluate(versionResolution);
    this.lastVersionSnapshot = VersionSnapshot.from({
      resolutions: versionResolution.resolutions,
      warnings: compatibility.warnings,
      rejectedPlugins: compatibility.rejectedPlugins
    });

    this.registry.setVersionResolutions(versionResolution.resolutions);

    for (const resolution of versionResolution.resolutions) {
      this.diagnosticsChannel.emit('version:resolved', { ...resolution });
    }

    for (const conflict of versionResolution.conflicts) {
      this.diagnosticsChannel.emit('version:conflict', { ...conflict });
    }

    for (const pluginId of compatibility.rejectedPlugins) {
      this.diagnosticsChannel.emit('version:rejected', { pluginId });
      this.registry.setFailed(pluginId, createStructuredError(new Error('capability version compatibility rejected plugin')));
    }

    const fullPlan = this.activationPlanner.plan(this.topologyGraph);
    const rejectedSet = new Set(compatibility.rejectedPlugins);
    this.lastActivationPlan = fullPlan.filter((pluginId) => !rejectedSet.has(pluginId));
    this.diagnosticsChannel.emit('plugin.runtime.diagnostics.topology:activationPlan', {
      activationOrder: [...this.lastActivationPlan]
    });

    const activationById = new Map(validated.map((entry) => [entry.descriptor.id, entry]));

    for (const pluginId of this.lastActivationPlan) {
      const activationItem = activationById.get(pluginId);
      if (!activationItem || rejectedSet.has(pluginId)) {
        continue;
      }

      await this.activatePlugin(activationItem.descriptor, activationItem.manifest, activationItem.loadOrder);
    }

    return this.registry.list();
  }

  async activatePlugin(descriptor, manifest, loadOrder) {
    try {
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
      return true;
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
      await this.healthMonitor.recordFailure({ pluginId: descriptor.id, source: 'lifecycle', error });
      return false;
    }
  }

  async retryActivation(pluginId) {
    const record = this.registry.get(pluginId);
    if (!record || record.state === PluginState.ACTIVE) {
      return false;
    }

    const activation = this.activationCatalog.get(pluginId);
    if (!activation) {
      return false;
    }

    return this.activatePlugin(activation.descriptor, activation.manifest, activation.loadOrder);
  }

  async isolatePlugin(pluginId) {
    const record = this.registry.get(pluginId);
    if (!record) {
      return false;
    }

    this.stateStore.unloadPlugin(pluginId);
    this.eventSystem.unregisterPlugin(pluginId);
    this.capabilityResolver.unbindProvider(pluginId);
    if (record.state !== PluginState.FAILED) {
      this.registry.setFailed(pluginId, createStructuredError(new Error('plugin isolated by health monitor')));
    }

    return true;
  }

  async disableCapabilityProvider(pluginId) {
    this.capabilityResolver.unbindProvider(pluginId);
    this.registry.unbindCapabilities(pluginId);
    return true;
  }

  async dependencyCascadeStop(pluginId) {
    const topology = this.getTopologySnapshot();
    const dependents = this.getDependentPlugins(topology.edges, pluginId);

    for (const dependentId of dependents) {
      await this.isolatePlugin(dependentId);
    }

    return dependents;
  }

  getDependentPlugins(edges, providerId) {
    const reverse = new Map();
    for (const edge of edges) {
      if (!reverse.has(edge.to)) {
        reverse.set(edge.to, new Set());
      }
      reverse.get(edge.to).add(edge.from);
    }

    const ordered = [];
    const visited = new Set();
    const walk = (current) => {
      const next = Array.from(reverse.get(current) ?? []).sort((left, right) => left.localeCompare(right));
      for (const entry of next) {
        if (visited.has(entry)) {
          continue;
        }

        visited.add(entry);
        ordered.push(entry);
        walk(entry);
      }
    };

    walk(providerId);
    return ordered;
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
      this.healthMonitor.clearPlugin(pluginId);
      this.topologyGraph.unregisterPlugin(pluginId);
      this.lastValidation = this.dependencyResolver.validate(this.topologyGraph);
      const versionResolution = this.versionResolver.resolve(this.topologyGraph);
      const compatibility = this.compatibilityChecker.evaluate(versionResolution);
      this.lastVersionSnapshot = VersionSnapshot.from({
        resolutions: versionResolution.resolutions,
        warnings: compatibility.warnings,
        rejectedPlugins: compatibility.rejectedPlugins
      });
      this.registry.setVersionResolutions(versionResolution.resolutions);
      this.lastActivationPlan = this.activationPlanner.plan(this.topologyGraph)
        .filter((entry) => !compatibility.rejectedPlugins.includes(entry));
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
      await this.healthMonitor.recordFailure({ pluginId, source: 'lifecycle', error });
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
