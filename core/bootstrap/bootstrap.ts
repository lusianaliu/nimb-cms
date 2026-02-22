import { loadConfig } from './config-loader.ts';
import { createRuntime } from './runtime-factory.ts';
import path from 'node:path';
import { BootstrapSnapshot } from './bootstrap-snapshot.ts';
import { FileSystemStorageAdapter, PersistenceEngine } from '../persistence/index.ts';
import { AuthService, SessionStore, createAuthMiddleware } from '../auth/index.ts';

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

  const restored = await persistenceEngine.restore();
  runtime.setRestoredState?.(restored.runtime);
  runtime.setPersistenceStatus?.(persistenceEngine.status());

  await authService.restore();

  await runtime.start();

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

  await persistenceEngine.persist({
    schemaVersion: 'v1',
    runtime: runtime.getState(),
    goals: inspector.goals(),
    orchestrator: inspector.orchestrator()
  });
  runtime.setPersistenceStatus?.(persistenceEngine.status());

  return Object.freeze({
    config,
    runtime,
    snapshot: bootstrapSnapshot,
    inspector,
    persistence: persistenceEngine.status(),
    authService,
    authMiddleware
  });
};
