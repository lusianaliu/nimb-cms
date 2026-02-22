import { CapabilityVersion } from './capability-version.ts';
import { VersionRange } from './version-range.ts';

const sortByDeterministicProvider = (left, right) => {
  const versionComparison = CapabilityVersion.compare(right.version, left.version);
  if (versionComparison !== 0) {
    return versionComparison;
  }

  if (left.loadOrder !== right.loadOrder) {
    return left.loadOrder - right.loadOrder;
  }

  return left.pluginId.localeCompare(right.pluginId);
};

export class VersionResolver {
  resolve(graph) {
    const resolutions = [];
    const conflicts = [];

    for (const node of graph.getNodes()) {
      for (const consumption of node.consumedCapabilities) {
        const providers = graph
          .getCapabilityProviders(consumption.capability)
          .map((provider) => ({ ...provider, version: CapabilityVersion.parse(provider.version) }));

        const range = VersionRange.parse(consumption.range);
        const matching = providers.filter((provider) => VersionRange.includes(range, provider.version));

        if (matching.length === 0) {
          conflicts.push({
            type: 'range-mismatch',
            pluginId: node.pluginId,
            capability: consumption.capability,
            range: range.raw,
            providers: providers.map((provider) => ({ pluginId: provider.pluginId, version: provider.version.raw }))
          });
          continue;
        }

        const sortedMatches = [...matching].sort(sortByDeterministicProvider);
        const selected = sortedMatches[0];
        const ambiguous = sortedMatches.filter((provider) => CapabilityVersion.compare(provider.version, selected.version) === 0);

        if (ambiguous.length > 1) {
          conflicts.push({
            type: 'ambiguous-provider',
            pluginId: node.pluginId,
            capability: consumption.capability,
            range: range.raw,
            candidates: ambiguous.map((provider) => ({ pluginId: provider.pluginId, version: provider.version.raw }))
          });
          continue;
        }

        resolutions.push({
          consumerId: node.pluginId,
          capability: consumption.capability,
          range: range.raw,
          providerId: selected.pluginId,
          version: selected.version.raw
        });
      }
    }

    return {
      valid: conflicts.length === 0,
      resolutions,
      conflicts
    };
  }
}
