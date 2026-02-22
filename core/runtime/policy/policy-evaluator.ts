const sortStrings = (values) => [...values].sort((left, right) => left.localeCompare(right));

const freezeDecision = (decision) => Object.freeze({
  ...decision,
  reasons: Object.freeze([...decision.reasons]),
  retryStrategy: decision.retryStrategy,
  fallback: Object.freeze({ ...decision.fallback })
});

export class PolicyEvaluator {
  evaluate(context) {
    const reasons = [];
    const pluginId = context.pluginId;
    const healthPlugins = context.healthSnapshot.plugins ?? [];
    const healthFailures = context.healthSnapshot.failures ?? [];
    const degradedSet = new Set(context.healthSnapshot.degradedCapabilities ?? []);

    if (pluginId && context.versionResolution.rejectedPlugins?.includes(pluginId)) {
      reasons.push('version-rejected-plugin');
    }

    if (context.routingDecision?.required === true && !context.routingDecision.providerId) {
      reasons.push('routing-provider-unavailable');
    }

    const pluginFailureCount = pluginId
      ? healthFailures.filter((entry) => entry.pluginId === pluginId).length
      : 0;

    const degradedByPlugin = healthPlugins
      .some((entry) => entry.pluginId === pluginId && entry.status === 'degraded');
    const degradedByCapability = context.capability ? degradedSet.has(context.capability) : false;
    const degradedMode = degradedByPlugin || degradedByCapability;

    const fallbackEnforced = Boolean(
      context.routingDecision
      && context.routingDecision.policy === 'fallback'
      && context.routingDecision.candidates?.[0]
      && context.routingDecision.candidates[0] !== context.routingDecision.providerId
    );

    const allowExecution = reasons.length === 0;
    const retryStrategy = allowExecution
      ? (degradedMode || pluginFailureCount > 0 ? 'exponential-backoff' : 'immediate-once')
      : 'none';

    return freezeDecision({
      allowExecution,
      degradedMode,
      fallback: {
        enforced: fallbackEnforced,
        providerId: context.routingDecision?.providerId ?? null
      },
      retryStrategy,
      reasons: sortStrings(reasons)
    });
  }
}
