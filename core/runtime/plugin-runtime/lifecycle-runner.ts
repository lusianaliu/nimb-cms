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
import { CapabilityRouter } from '../routing/index.ts';
import { SandboxRunner } from '../sandbox/index.ts';
import { PolicyEngine } from '../policy/index.ts';
import { Scheduler } from '../scheduler/index.ts';
import { Reconciler, ReconcileLoop } from '../reconciler/index.ts';
import { StateProjector, RuntimeStateSnapshot } from '../state/index.ts';
import { Orchestrator, OrchestratorSnapshot } from '../orchestrator/index.ts';
import { GoalEngine, GoalSnapshot } from '../goals/index.ts';
import { BootstrapSnapshot } from '../../bootstrap/bootstrap-snapshot.ts';

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
    this.capabilityRouter = options.capabilityRouter ?? new CapabilityRouter({
      registry: this.registry,
      diagnosticsChannel: this.diagnosticsChannel,
      topologyProvider: () => this.getTopologySnapshot(),
      isProviderActive: (pluginId) => this.registry.get(pluginId)?.state === PluginState.ACTIVE,
      policies: options.routingPolicies ?? {}
    });
    this.activationCatalog = new Map();
    this.sandboxRunner = options.sandboxRunner ?? new SandboxRunner({ diagnosticsChannel: this.diagnosticsChannel });
    this.policyEngine = options.policyEngine ?? new PolicyEngine({
      diagnosticsChannel: this.diagnosticsChannel,
      topologySnapshot: () => this.getTopologySnapshot(),
      healthSnapshot: () => this.healthMonitor.snapshot(),
      versionResolution: () => this.lastVersionSnapshot
    });
    this.scheduler = options.scheduler ?? new Scheduler({
      diagnosticsChannel: this.diagnosticsChannel,
      topologyProvider: () => this.getTopologySnapshot(),
      healthProvider: () => this.healthMonitor.snapshot()
    });
    this.healthMonitor = options.healthMonitor ?? new HealthMonitor({
      diagnosticsChannel: this.diagnosticsChannel,
      recoveryHandlers: {
        retryActivation: async (pluginId) => this.retryActivation(pluginId),
        isolatePlugin: async (pluginId) => this.isolatePlugin(pluginId),
        disableCapabilityProvider: async (pluginId) => this.disableCapabilityProvider(pluginId),
        dependencyCascadeStop: async (pluginId) => this.dependencyCascadeStop(pluginId)
      }
    });
    this.reconciler = options.reconciler ?? new Reconciler({
      diagnosticsChannel: this.diagnosticsChannel,
      topologyProvider: () => this.getTopologySnapshot(),
      healthProvider: () => this.healthMonitor.snapshot(),
      schedulerProvider: () => this.scheduler.snapshot(),
      policyProvider: () => this.policyEngine.snapshot()
    });
    this.reconcileLoop = options.reconcileLoop ?? new ReconcileLoop({
      reconciler: this.reconciler,
      scheduler: this.scheduler,
      diagnosticsChannel: this.diagnosticsChannel
    });
    this.orchestrator = options.orchestrator ?? new Orchestrator({
      diagnosticsChannel: this.diagnosticsChannel,
      scheduler: this.scheduler,
      policyEngine: this.policyEngine,
      topologyProvider: () => this.getTopologySnapshot()
    });
    this.goalEngine = options.goalEngine ?? new GoalEngine({
      runtimeStateProvider: () => this.getState(),
      reconcilerProvider: () => this.reconciler.snapshot(),
      schedulerProvider: () => this.scheduler.snapshot(),
      emitIntent: (intent) => this.intent(intent)
    });
    this.stateProjector = options.stateProjector ?? new StateProjector({
      topologyProvider: () => this.getTopologySnapshot(),
      healthProvider: () => this.healthMonitor.snapshot(),
      policyProvider: () => this.policyEngine.snapshot(),
      schedulerProvider: () => this.scheduler.snapshot(),
      reconcilerProvider: () => this.reconciler.snapshot()
    });
    this.capabilityResolver = options.capabilityResolver ?? new CapabilityResolver({
      registry: this.registry,
      logger: this.logger,
      capabilityTrace: this.capabilityTrace,
      healthReporter: (failure) => this.healthMonitor.recordFailure(failure),
      router: this.capabilityRouter
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
    this.bootstrapSnapshot = BootstrapSnapshot.empty();
    this.persistenceStatus = Object.freeze({ lastSaveTime: null, storedKeys: Object.freeze([]), storageHealth: 'idle' });
    this.authStatus = Object.freeze({ activeSessions: 0, users: Object.freeze([]), authHealth: 'idle' });
    this.restoredRuntimeState = null;
    this.runtimeStarted = false;
    this.adminExecutor = options.adminExecutor ?? (async () => ({ success: false, outcome: 'unsupported' }));
    this.adminStatusProvider = options.adminStatusProvider ?? (() => Object.freeze({ lastCommands: Object.freeze([]), commandHistory: Object.freeze([]), adminHealth: 'idle' }));
    this.contentStatusProvider = options.contentStatusProvider ?? (() => Object.freeze({ registeredTypes: Object.freeze([]), schemaHashes: Object.freeze([]), validation: Object.freeze({ valid: true, errors: Object.freeze([]) }) }));
    this.inspector = options.inspector ?? new RuntimeInspector({
      registry: this.registry,
      eventTrace: this.eventTrace,
      capabilityTrace: this.capabilityTrace,
      stateTrace: this.stateTrace,
      diagnosticsChannel: this.diagnosticsChannel,
      topologyProvider: () => this.getTopologySnapshot(),
      healthProvider: () => this.healthMonitor.snapshot(),
      versionProvider: () => this.lastVersionSnapshot,
      routingProvider: () => this.capabilityRouter.snapshot(),
      sandboxProvider: () => this.sandboxRunner.snapshot(),
      policyProvider: () => this.policyEngine.snapshot(),
      schedulerProvider: () => this.scheduler.snapshot(),
      reconcilerProvider: () => this.reconciler.snapshot(),
      orchestratorProvider: () => this.orchestrator?.snapshot?.() ?? OrchestratorSnapshot.empty(),
      goalsProvider: () => this.goalEngine?.snapshot?.() ?? GoalSnapshot.empty(),
      stateProvider: () => this.getState(),
      bootstrapProvider: () => this.bootstrapSnapshot,
      persistenceProvider: () => this.persistenceStatus,
      authProvider: () => this.authStatus,
      adminProvider: () => this.getAdminStatus(),
      contentProvider: () => this.getContentStatus()
    });
  }

  getInspector() {
    return this.inspector;
  }

  setBootstrapSnapshot(snapshot) {
    this.bootstrapSnapshot = snapshot ?? BootstrapSnapshot.empty();
    return this.bootstrapSnapshot;
  }

  setPersistenceStatus(status) {
    this.persistenceStatus = Object.freeze({
      lastSaveTime: status?.lastSaveTime ?? null,
      storedKeys: Object.freeze([...(status?.storedKeys ?? [])]),
      storageHealth: status?.storageHealth ?? 'idle'
    });

    return this.persistenceStatus;
  }

  setAuthStatus(status) {
    this.authStatus = Object.freeze({
      activeSessions: status?.activeSessions ?? 0,
      users: Object.freeze([...(status?.users ?? [])]),
      authHealth: status?.authHealth ?? 'idle'
    });

    return this.authStatus;
  }

  setRestoredState(snapshot) {
    this.restoredRuntimeState = snapshot ?? null;
    return this.restoredRuntimeState;
  }

  getRestoredState() {
    return this.restoredRuntimeState;
  }

  getState() {
    if (!this.runtimeStarted && this.restoredRuntimeState) {
      return this.restoredRuntimeState;
    }

    if (!this.stateProjector || typeof this.stateProjector.project !== 'function') {
      return RuntimeStateSnapshot.empty();
    }

    return this.stateProjector.project();
  }

  getTopologySnapshot() {
    return TopologySnapshot.from({
      graph: this.topologyGraph,
      activationOrder: this.lastActivationPlan,
      validation: this.lastValidation
    });
  }

  setAdminExecutor(executor) {
    this.adminExecutor = typeof executor === 'function'
      ? executor
      : (async () => ({ success: false, outcome: 'unsupported' }));

    return this.adminExecutor;
  }

  setAdminStatusProvider(provider) {
    this.adminStatusProvider = typeof provider === 'function'
      ? provider
      : (() => Object.freeze({ lastCommands: Object.freeze([]), commandHistory: Object.freeze([]), adminHealth: 'idle' }));

    return this.adminStatusProvider;
  }

  setContentStatusProvider(provider) {
    this.contentStatusProvider = typeof provider === 'function'
      ? provider
      : (() => Object.freeze({ registeredTypes: Object.freeze([]), schemaHashes: Object.freeze([]), validation: Object.freeze({ valid: true, errors: Object.freeze([]) }) }));

    return this.contentStatusProvider;
  }

  getContentStatus() {
    return this.contentStatusProvider?.() ?? Object.freeze({ registeredTypes: Object.freeze([]), schemaHashes: Object.freeze([]), validation: Object.freeze({ valid: true, errors: Object.freeze([]) }) });
  }

  async executeAdminCommand(command) {
    this.diagnosticsChannel.emit('admin:command:accepted', { action: command?.action, requestId: command?.requestId });
    const result = await this.adminExecutor(command);
    this.diagnosticsChannel.emit('admin:command:completed', { action: command?.action, requestId: command?.requestId, success: result?.success === true });
    return Object.freeze({ ...result });
  }

  getAdminStatus() {
    return this.adminStatusProvider();
  }

  registerGoal(goal) {
    return this.goalEngine.register(goal);
  }

  registerGoals(goals = []) {
    return this.goalEngine.registerMany(goals);
  }

  async intent(input) {
    if (!this.orchestrator || typeof this.orchestrator.intent !== 'function') {
      throw new Error('runtime orchestrator unavailable');
    }

    return this.orchestrator.intent(input);
  }

  async start() {
    this.runtimeStarted = true;
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

      const policyDecision = this.policyEngine.evaluate({
        pluginId: descriptor.id,
        stage: 'register',
        routingDecision: {
          required: false,
          policy: 'single',
          providerId: descriptor.id,
          candidates: [descriptor.id]
        }
      });

      if (!policyDecision.allowExecution) {
        throw new Error(`policy blocked runtime lifecycle execution: ${policyDecision.reasons.join(', ')}`);
      }

      const consumedCapabilities = Array.isArray(manifest.consumedCapabilities)
        ? manifest.consumedCapabilities
        : [];
      const dependencies = consumedCapabilities
        .map((capability) => this.capabilityRouter.selectProvider({ pluginId: descriptor.id, capability, required: false })?.providerId)
        .filter((providerId) => typeof providerId === 'string')
        .sort((left, right) => left.localeCompare(right));

      this.scheduler.enqueueLifecycle({
        pluginId: descriptor.id,
        stage: 'register',
        loadOrder,
        operation: (sandboxContracts) => register(sandboxContracts),
        policyDecision,
        capability: manifest.declaredCapabilities?.[0] ?? null,
        dependencies,
        priority: policyDecision.degradedMode ? 1 : 2
      });

      const [scheduled] = await this.scheduler.drain((entry) => this.sandboxRunner.executeLifecycle({
        pluginId: entry.pluginId,
        stage: entry.stage,
        loadOrder: entry.loadOrder,
        contracts: runtimeContracts,
        operation: entry.operation
      }));

      if (!scheduled?.ok) {
        throw scheduled?.error ?? new Error(`scheduled lifecycle execution failed for plugin ${descriptor.id}`);
      }

      await this.reconcileLoop.runAfterSchedulerCycle({
        executeAction: (action) => this.executeReconcileAction(action),
        policyDecision: Object.freeze({ allowExecution: true, degradedMode: false, retryStrategy: 'none', reasons: Object.freeze([]) })
      });
      await this.goalEngine.evaluateCycle();

      const disposer = scheduled.value;
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


  async executeReconcileAction(action) {
    if (action.type === 'restart-plugin' || action.type === 'schedule-plugin') {
      return this.retryActivation(action.pluginId);
    }

    if (action.type === 'remove-topology-node') {
      return this.removeInvalidTopologyNode(action.pluginId);
    }

    return false;
  }

  async removeInvalidTopologyNode(pluginId) {
    this.topologyGraph.unregisterPlugin(pluginId);
    this.activationCatalog.delete(pluginId);
    this.lastActivationPlan = this.lastActivationPlan.filter((entry) => entry !== pluginId);
    this.stateStore.unloadPlugin(pluginId);
    this.eventSystem.unregisterPlugin(pluginId);
    this.capabilityResolver.unbindProvider(pluginId);
    this.healthMonitor.clearPlugin(pluginId);
    return true;
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
