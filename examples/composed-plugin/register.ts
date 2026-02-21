/**
 * Architectural intent:
 * Demonstrates capability composition via runtime contracts with no direct plugin imports.
 */
export const register = (ctx) => {
  const contentCreate = ctx.useCapability('content:create');

  return async () => {
    await contentCreate.create({ title: 'composed-plugin draft' });
    ctx.logger.info('composed-plugin invoked content:create capability');
  };
};

export default register;
