import { bindSummaryCapability } from './manifest.ts';

/**
 * Architectural intent:
 * Demonstrates runtime-owned state that reacts to declared events and is exposed via capability.
 */
export const register = (ctx) => {
  ctx.state.define('content-summary', {
    createdCount: 0,
    latestTitle: null
  });

  const offContentCreated = ctx.on('content:created', async (payload) => {
    await ctx.state.update('content-summary', (current) => ({
      createdCount: Number(current.createdCount ?? 0) + 1,
      latestTitle: String(payload?.title ?? 'untitled')
    }));
  });

  bindSummaryCapability(
    () => ctx.state.get('content-summary'),
    (handler) => ctx.state.subscribe('content-summary', handler)
  );

  return () => {
    offContentCreated();
  };
};

export default register;
