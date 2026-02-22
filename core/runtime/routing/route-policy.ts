const normalizeNumber = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

const normalizeProviderList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0))].sort((left, right) => left.localeCompare(right));
};

export const RoutingPolicyType = Object.freeze({
  SINGLE: 'single',
  PRIORITY: 'priority',
  WEIGHTED: 'weighted',
  FALLBACK: 'fallback'
});

export class RoutePolicy {
  static from(capabilityName, policy) {
    if (!policy || typeof policy !== 'object') {
      return Object.freeze({
        capability: capabilityName,
        type: RoutingPolicyType.SINGLE,
        providerId: null
      });
    }

    if (policy.type === RoutingPolicyType.PRIORITY) {
      return Object.freeze({
        capability: capabilityName,
        type: RoutingPolicyType.PRIORITY,
        order: normalizeProviderList(policy.order)
      });
    }

    if (policy.type === RoutingPolicyType.WEIGHTED) {
      const weights = Object.fromEntries(
        Object.entries(policy.weights ?? {})
          .filter(([providerId]) => typeof providerId === 'string' && providerId.trim().length > 0)
          .map(([providerId, weight]) => [providerId, normalizeNumber(weight)])
      );

      return Object.freeze({
        capability: capabilityName,
        type: RoutingPolicyType.WEIGHTED,
        weights: Object.freeze(weights),
        salt: typeof policy.salt === 'string' ? policy.salt : ''
      });
    }

    if (policy.type === RoutingPolicyType.FALLBACK) {
      return Object.freeze({
        capability: capabilityName,
        type: RoutingPolicyType.FALLBACK,
        chain: normalizeProviderList(policy.chain)
      });
    }

    return Object.freeze({
      capability: capabilityName,
      type: RoutingPolicyType.SINGLE,
      providerId: typeof policy.providerId === 'string' ? policy.providerId : null
    });
  }
}
