const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze(entry)));

export class TopologySnapshot {
  static from({ graph, activationOrder, validation }) {
    return Object.freeze({
      nodes: freezeEntries(graph.getNodes().map((node) => ({
        pluginId: node.pluginId,
        loadOrder: node.loadOrder,
        exportedCapabilities: [...node.exportedCapabilities],
        consumedCapabilities: [...node.consumedCapabilities]
      }))),
      edges: freezeEntries(graph.getEdges().map((edge) => ({ ...edge }))),
      activationOrder: Object.freeze([...activationOrder]),
      unresolvedDependencies: freezeEntries((validation?.unresolvedDependencies ?? []).map((dependency) => ({ ...dependency })))
    });
  }
}
