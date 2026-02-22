/**
 * Architectural intent:
 * Demonstrates runtime-mediated event subscription and capability composition.
 */
export const register = (ctx) => {
  const contentCreate = ctx.useCapability('content:create');

  const disposeSubscription = ctx.on('content:created', async (payload) => {
    await contentCreate.create({
      title: `reaction:${String(payload?.title ?? 'untitled')}`
    });

    ctx.logger.info('event-reactive-plugin handled content:created');
  });

  return () => {
    disposeSubscription();
  };
};

export default register;
