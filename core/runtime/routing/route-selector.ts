import { RoutingPolicyType } from './route-policy.ts';

const stableHash = (input) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const byPriority = (providers, orderedProviders) => {
  const orderIndex = new Map(orderedProviders.map((entry, index) => [entry, index]));
  return [...providers].sort((left, right) => {
    const leftIndex = orderIndex.has(left) ? orderIndex.get(left) : Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndex.has(right) ? orderIndex.get(right) : Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });
};

export class RouteSelector {
  select(options) {
    const sortedProviders = [...options.providers].sort((left, right) => left.localeCompare(right));
    if (sortedProviders.length === 0) {
      return null;
    }

    if (options.policy.type === RoutingPolicyType.PRIORITY) {
      const ordered = byPriority(sortedProviders, options.policy.order);
      return { selectedProviderId: ordered[0], candidates: ordered };
    }

    if (options.policy.type === RoutingPolicyType.FALLBACK) {
      const ordered = byPriority(sortedProviders, options.policy.chain);
      return { selectedProviderId: ordered[0], candidates: ordered };
    }

    if (options.policy.type === RoutingPolicyType.WEIGHTED) {
      const weightedProviders = sortedProviders
        .map((providerId) => ({ providerId, weight: options.policy.weights[providerId] ?? 0 }))
        .filter((entry) => entry.weight > 0);

      const candidates = weightedProviders.length > 0
        ? weightedProviders
        : sortedProviders.map((providerId) => ({ providerId, weight: 1 }));

      const totalWeight = candidates.reduce((sum, entry) => sum + entry.weight, 0);
      const hashInput = `${options.capability}|${options.consumerId}|${options.invocationKey}|${options.topologyKey}|${options.policy.salt}`;
      const cursor = stableHash(hashInput) % totalWeight;

      let offset = 0;
      for (const candidate of candidates) {
        offset += candidate.weight;
        if (cursor < offset) {
          return {
            selectedProviderId: candidate.providerId,
            candidates: candidates.map((entry) => entry.providerId)
          };
        }
      }
    }

    const selectedProviderId = options.policy.providerId && sortedProviders.includes(options.policy.providerId)
      ? options.policy.providerId
      : sortedProviders[0];

    return { selectedProviderId, candidates: sortedProviders };
  }
}
