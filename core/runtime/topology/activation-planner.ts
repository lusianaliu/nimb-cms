export class ActivationPlanner {
  plan(graph: {
    getNodes: () => Array<{ pluginId: string, loadOrder: number }>,
    getEdges: () => Array<{ from: string, to: string }>
  }) {
    const nodes = graph.getNodes();
    const indegree = new Map();
    const reverseAdjacency = new Map();

    for (const node of nodes) {
      indegree.set(node.pluginId, 0);
      reverseAdjacency.set(node.pluginId, new Set());
    }

    for (const edge of graph.getEdges()) {
      if (!indegree.has(edge.from) || !indegree.has(edge.to)) {
        continue;
      }

      indegree.set(edge.from, indegree.get(edge.from) + 1);
      reverseAdjacency.get(edge.to).add(edge.from);
    }

    const rank = new Map(nodes.map((node) => [node.pluginId, node.loadOrder]));
    const available = nodes
      .filter((node) => indegree.get(node.pluginId) === 0)
      .map((node) => node.pluginId);

    const sortAvailable = () => {
      available.sort((left, right) => (rank.get(left) - rank.get(right)) || left.localeCompare(right));
    };

    sortAvailable();

    const ordered = [];

    while (available.length > 0) {
      const current = available.shift();
      ordered.push(current);

      const dependents = [...(reverseAdjacency.get(current) ?? [])]
        .sort((left, right) => (rank.get(left) - rank.get(right)) || left.localeCompare(right));

      for (const dependentId of dependents) {
        indegree.set(dependentId, indegree.get(dependentId) - 1);
        if (indegree.get(dependentId) === 0) {
          available.push(dependentId);
        }
      }

      sortAvailable();
    }

    return ordered;
  }
}
