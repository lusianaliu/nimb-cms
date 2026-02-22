import { loadConfig } from './config-loader.ts';
import { createRuntime } from './runtime-factory.ts';
import { BootstrapSnapshot } from './bootstrap-snapshot.ts';

const toRuntimeStatus = (runtime) => {
  const state = runtime.getState?.();
  return state?.derivedStatus?.systemHealthy === true ? 'healthy' : 'degraded';
};

export const createBootstrap = async ({ cwd = process.cwd(), startupTimestamp = new Date().toISOString() } = {}) => {
  const config = loadConfig({ cwd });
  const runtime = createRuntime(config);

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

  return Object.freeze({
    config,
    runtime,
    snapshot: bootstrapSnapshot,
    inspector
  });
};
