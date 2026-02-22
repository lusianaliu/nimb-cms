import { loadConfig } from './config-loader.ts';
import { createRuntime } from './runtime-factory.ts';
import path from 'node:path';
import { BootstrapSnapshot } from './bootstrap-snapshot.ts';
import { FileSystemStorageAdapter, PersistenceEngine } from '../persistence/index.ts';
import { AuthService, SessionStore, createAuthMiddleware } from '../auth/index.ts';
import { CommandDispatcher, createAdminController } from '../admin/index.ts';

const toRuntimeStatus = (runtime) => {
  const state = runtime.getState?.();
  return state?.derivedStatus?.systemHealthy === true ? 'healthy' : 'degraded';
};

export const createBootstrap = async ({ cwd = process.cwd(), startupTimestamp = new Date().toISOString() } = {}) => {
  const config = loadConfig({ cwd });
  const runtime = createRuntime(config);
  const storageAdapter = new FileSystemStorageAdapter({ rootDirectory: path.join(cwd, '.nimb') });
  const persistenceEngine = new PersistenceEngine({ storageAdapter });
  const sessionStore = new SessionStore({ storageAdapter });
  const authService = new AuthService({
    sessionStore,
    mode: config?.runtime?.mode ?? 'development',
    onStateChange: (status) => runtime.setAuthStatus?.(status)
  });
  const authMiddleware = createAuthMiddleware({ authService });

  const restore = async () => {
    const restored = await persistenceEngine.restore();
    runtime.setRestoredState?.(restored.runtime);
    runtime.setPersistenceStatus?.(persistenceEngine.status());
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

  return Object.freeze({
    config,
    runtime,
    snapshot: bootstrapSnapshot,
    inspector,
    persistence: persistenceEngine.status(),
    authService,
    authMiddleware,
    adminController
  });
};
