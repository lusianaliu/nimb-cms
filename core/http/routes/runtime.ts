import { jsonResponse } from '../response.ts';

const toRuntimeSummary = ({ config, inspector, startupTimestamp, clock }) => {
  const plugins = inspector.snapshot().plugins
    .map((plugin) => plugin.id)
    .filter(Boolean);

  const startedAt = Date.parse(startupTimestamp);
  const now = Date.parse(clock());
  const uptime = Number.isFinite(startedAt) && Number.isFinite(now)
    ? Math.max(0, now - startedAt)
    : 0;

  return {
    mode: config.runtime.mode,
    plugins,
    uptime
  };
};

export const createRuntimeRoute = ({ config, runtime, startupTimestamp, clock }) => ({
  method: 'GET',
  path: '/runtime',
  handler: () => jsonResponse(toRuntimeSummary({
    config,
    inspector: runtime.getInspector(),
    startupTimestamp,
    clock
  }))
});
