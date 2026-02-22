export class DependencyResolver {
  constructor(options: { allowDuplicateProviders?: boolean } = {}) {
    this.allowDuplicateProviders = options.allowDuplicateProviders ?? false;
  }

  validate(graph: {
    getNodes: () => Array<{ pluginId: string, consumedCapabilities: Array<{ capability: string, range: string }> }>,
    getProviderIds: (capabilityName: string) => string[],
    getEdges: () => Array<{ from: string, to: string, capability: string }>
  }) {
    const unresolvedDependencies = [];
    const duplicateProviders = [];

    for (const node of graph.getNodes()) {
      for (const consumption of node.consumedCapabilities) {
        const providers = graph.getProviderIds(consumption.capability);

        if (providers.length === 0) {
          unresolvedDependencies.push({
            pluginId: node.pluginId,
            capability: consumption.capability
          });
        }

        if (!this.allowDuplicateProviders && providers.length > 1) {
          duplicateProviders.push({
            pluginId: node.pluginId,
            capability: consumption.capability,
            providers
          });
        }
      }
    }

    const cycles = this.detectCycles(graph);

    return {
      valid: unresolvedDependencies.length === 0 && duplicateProviders.length === 0 && cycles.length === 0,
      unresolvedDependencies,
      duplicateProviders,
      cycles
    };
  }

  detectCycles(graph: { getEdges: () => Array<{ from: string, to: string }> }) {
    const adjacency = new Map();

    for (const edge of graph.getEdges()) {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, new Set());
      }

      adjacency.get(edge.from).add(edge.to);

      if (!adjacency.has(edge.to)) {
        adjacency.set(edge.to, new Set());
      }
    }

    const visiting = new Set();
    const visited = new Set();
    const cycles = [];
    const cycleKeys = new Set();

    const walk = (nodeId, path) => {
      if (visiting.has(nodeId)) {
        const start = path.indexOf(nodeId);
        const cycle = [...path.slice(start), nodeId];
        const normalized = this.normalizeCycle(cycle);
        const cycleKey = normalized.join('>');
        if (!cycleKeys.has(cycleKey)) {
          cycleKeys.add(cycleKey);
          cycles.push(normalized);
        }
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);
      const nextPath = [...path, nodeId];
      const neighbors = [...(adjacency.get(nodeId) ?? [])].sort((left, right) => left.localeCompare(right));

      for (const neighbor of neighbors) {
        walk(neighbor, nextPath);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    const nodes = [...adjacency.keys()].sort((left, right) => left.localeCompare(right));
    for (const nodeId of nodes) {
      walk(nodeId, []);
    }

    return cycles;
  }

  normalizeCycle(cycle: string[]) {
    const ring = cycle.slice(0, -1);
    if (ring.length === 0) {
      return [];
    }

    const rotations = ring.map((_, index) => [...ring.slice(index), ...ring.slice(0, index)]);
    rotations.sort((left, right) => {
      const leftKey = left.join('>');
      const rightKey = right.join('>');
      return leftKey.localeCompare(rightKey);
    });

    const canonical = rotations[0];
    return [...canonical, canonical[0]];
  }
}
