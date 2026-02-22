/**
 * Architectural intent:
 * Consumes provider capability instead of direct cross-plugin state access.
 */
export const register = (ctx) => {
  const summary = ctx.useCapability('state-reactive:content-summary');

  const offSummary = summary.subscribe((value) => {
    ctx.logger.info('state-observer-plugin received summary update', {
      value
    });
  });

  return () => {
    offSummary();
  };
};

export default register;
