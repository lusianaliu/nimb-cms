const sortStrings = (values: string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right));

export class TopologyGraph {
  constructor() {
    this.nodes = new Map();
    this.providers = new Map();
  }

  registerPlugin(pluginId: string, manifest: { exportedCapabilities?: Record<string, unknown>, consumedCapabilities?: string[] }, loadOrder: number) {
    const exportedCapabilities = sortStrings(Object.keys(manifest.exportedCapabilities ?? {}));
    const consumedCapabilities = sortStrings(manifest.consumedCapabilities ?? []);

    this.unregisterPlugin(pluginId);

    const node = {
      pluginId,
      loadOrder,
      exportedCapabilities,
      consumedCapabilities
    };

    this.nodes.set(pluginId, node);

    for (const capabilityName of exportedCapabilities) {
      if (!this.providers.has(capabilityName)) {
        this.providers.set(capabilityName, new Set());
      }

      this.providers.get(capabilityName).add(pluginId);
    }
  }

  unregisterPlugin(pluginId: string) {
    const current = this.nodes.get(pluginId);
    if (!current) {
      return;
    }

    for (const capabilityName of current.exportedCapabilities) {
      const providerSet = this.providers.get(capabilityName);
      if (!providerSet) {
        continue;
      }

      providerSet.delete(pluginId);
      if (providerSet.size === 0) {
        this.providers.delete(capabilityName);
      }
    }

    this.nodes.delete(pluginId);
  }

  getProviderIds(capabilityName: string) {
    return sortStrings(Array.from(this.providers.get(capabilityName) ?? []));
  }

  getNodes() {
    return Array.from(this.nodes.values())
      .sort((left, right) => left.loadOrder - right.loadOrder || left.pluginId.localeCompare(right.pluginId))
      .map((node) => ({ ...node }));
  }

  getEdges() {
    const edges = [];

    for (const node of this.getNodes()) {
      for (const capabilityName of node.consumedCapabilities) {
        const providers = this.getProviderIds(capabilityName);

        for (const providerId of providers) {
          edges.push({
            from: node.pluginId,
            to: providerId,
            capability: capabilityName
          });
        }
      }
    }

    return edges.sort((left, right) => {
      if (left.from !== right.from) {
        return left.from.localeCompare(right.from);
      }

      if (left.to !== right.to) {
        return left.to.localeCompare(right.to);
      }

      return left.capability.localeCompare(right.capability);
    });
  }
}
