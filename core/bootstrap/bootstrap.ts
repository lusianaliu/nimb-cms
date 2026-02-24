import { loadConfig } from '../config/config-loader.ts';
import { createRuntime } from './runtime-factory.ts';
import { BootstrapSnapshot } from './bootstrap-snapshot.ts';
import { FileSystemStorageAdapter, PersistenceEngine } from '../persistence/index.ts';
import { AuthService, SessionStore, createAuthMiddleware } from '../auth/index.ts';
import { CommandDispatcher, createAdminController } from '../admin/index.ts';
import { ContentRegistry, ContentStore, EntryRegistry } from '../content/index.ts';
import { createProjectModel, createProjectPaths } from '../project/index.ts';
import { resolveRuntimeMode } from '../runtime/resolve-runtime-mode.ts';

const toRuntimeStatus = (runtime) => {
  const state = runtime.getState?.();
  return state?.derivedStatus?.systemHealthy === true ? 'healthy' : 'degraded';
};

export const createBootstrap = async ({ project = createProjectModel(), cwd = undefined, startupTimestamp = new Date().toISOString() } = {}) => {
  const resolvedProject = cwd ? createProjectModel({ projectRoot: cwd }) : project;
  const resolvedPaths = createProjectPaths(resolvedProject.projectRoot ?? resolvedProject.root);
  const config = loadConfig({ cwd: resolvedPaths.projectRoot });
  const runtimeMode = resolveRuntimeMode(resolvedPaths);
  const runtime = createRuntime(config, resolvedPaths, { runtimeMode });
  runtime.setRuntimeMode?.(runtimeMode);
  runtime.setConfig?.(config);
  const storageAdapter = new FileSystemStorageAdapter({ rootDirectory: resolvedPaths.persistenceDir });
  const persistenceEngine = new PersistenceEngine({ storageAdapter });
  const sessionStore = new SessionStore({ storageAdapter });
  const authService = new AuthService({
    sessionStore,
    mode: config?.runtime?.mode ?? 'development',
    onStateChange: (status) => runtime.setAuthStatus?.(status)
  });
  const authMiddleware = createAuthMiddleware({ authService });
  const contentRegistry = new ContentRegistry();
  const contentStore = new ContentStore({ storageAdapter });
  const entryRegistry = new EntryRegistry({ contentRegistry, rootDirectory: resolvedPaths.projectRoot });


  const restore = async () => {
    const restored = await persistenceEngine.restore();
    runtime.setRestoredState?.(restored.runtime);
    runtime.setPersistenceStatus?.(persistenceEngine.status());

    const restoredSchemas = await contentStore.restore();
    for (const schema of restoredSchemas.types) {
      contentRegistry.register(schema, { source: 'restore' });
    }

    entryRegistry.restoreFromDisk();
  };

  const persist = async () => {
    const inspector = runtime.getInspector();
    await persistenceEngine.persist({
      schemaVersion: 'v1',
      runtime: runtime.getState(),
      goals: inspector.goals(),
      orchestrator: inspector.orchestrator()
    });
    runtime.setPersistenceStatus?.(persistenceEngine.status());
  };

  const persistContentTypes = async () => contentStore.persist({
    schemaVersion: 'v1',
    types: contentRegistry.list()
  });

  const persistEntries = async () => entryRegistry.persist();

  await restore();
  await authService.restore();
  await runtime.start();

  const dispatcher = new CommandDispatcher({
    executor: {
      execute: async (command) => runtime.executeAdminCommand({
        ...command,
        execute: {
          restart: async () => {
            await runtime.start();
            return Object.freeze({ restarted: true });
          },
          persist: async () => {
            await persist();
            return Object.freeze({ persisted: true, persistence: runtime.getInspector().persistence() });
          },
          reconcile: async () => {
            const goals = await runtime.goalEngine.evaluateCycle();
            return Object.freeze({ reconciled: true, goals });
          }
        }
      })
    }
  });

  runtime.setAdminStatusProvider?.(() => dispatcher.status());
  runtime.setAdminExecutor?.(async (command) => {
    if (command.action === 'runtime.restart') {
      const outcome = await command.execute.restart();
      return Object.freeze({ success: true, action: command.action, outcome });
    }

    if (command.action === 'runtime.persist') {
      const outcome = await command.execute.persist();
      return Object.freeze({ success: true, action: command.action, outcome });
    }

    if (command.action === 'goals.reconcile') {
      const outcome = await command.execute.reconcile();
      return Object.freeze({ success: true, action: command.action, outcome });
    }

    return Object.freeze({ success: false, action: command.action, outcome: Object.freeze({ reason: 'unsupported-command' }) });
  });

  const adminController = createAdminController({ dispatcher });

  const inspector = runtime.getInspector();
  const pluginIds = inspector.snapshot().plugins.map((plugin) => plugin.id).filter(Boolean);
  const diagnostics = inspector.snapshot().diagnostics;
  const bootstrapSnapshot = BootstrapSnapshot.create({
    config,
    startupTimestamp,
    runtimeStatus: toRuntimeStatus(runtime),
    loadedPlugins: pluginIds,
    diagnostics
  });

  runtime.setBootstrapSnapshot?.(bootstrapSnapshot);

  await persist();
  await persistContentTypes();
  await persistEntries();
  runtime.setContentStatusProvider?.(() => contentRegistry.inspectorSnapshot());
  runtime.setEntryStatusProvider?.(() => entryRegistry.inspectorSnapshot());
  runtime.setEntryQueryStatusProvider?.(() => entryRegistry.queryInspectorSnapshot());

  return Object.freeze({
    config,
    runtime,
    snapshot: bootstrapSnapshot,
    inspector,
    persistence: persistenceEngine.status(),
    authService,
    authMiddleware,
    adminController,
    contentRegistry,
    contentStore,
    persistContentTypes,
    entryRegistry,
    persistEntries,
    runtimeMode
  });
};
