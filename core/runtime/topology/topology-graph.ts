const sortStrings = (values: string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right));

export class TopologyGraph {
  constructor() {
    this.nodes = new Map();
    this.providers = new Map();
  }

  registerPlugin(pluginId: string, manifest: {
    exportedCapabilities?: Record<string, unknown>,
    providedCapabilities?: Record<string, { version: string }>,
    consumedCapabilities?: Record<string, { range: string }>
  }, loadOrder: number) {
    const exportedCapabilities = sortStrings(Object.keys(manifest.exportedCapabilities ?? {}));
    const consumedCapabilities = Object.entries(manifest.consumedCapabilities ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([capability, declaration]) => ({ capability, range: declaration.range }));
    const providedCapabilities = Object.entries(manifest.providedCapabilities ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([capability, declaration]) => ({ capability, version: declaration.version }));

    this.unregisterPlugin(pluginId);

    const node = {
      pluginId,
      loadOrder,
      exportedCapabilities,
      providedCapabilities,
      consumedCapabilities
    };

    this.nodes.set(pluginId, node);

    for (const capabilityName of exportedCapabilities) {
      if (!this.providers.has(capabilityName)) {
        this.providers.set(capabilityName, new Set());
      }

      const capabilityVersion = manifest.providedCapabilities?.[capabilityName]?.version ?? '0.0.0';
      this.providers.get(capabilityName).add(Object.freeze({ pluginId, version: capabilityVersion, loadOrder }));
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

      for (const provider of Array.from(providerSet)) {
        if (provider.pluginId === pluginId) {
          providerSet.delete(provider);
        }
      }
      if (providerSet.size === 0) {
        this.providers.delete(capabilityName);
      }
    }

    this.nodes.delete(pluginId);
  }

  getProviderIds(capabilityName: string) {
    return sortStrings(Array.from(this.providers.get(capabilityName) ?? []).map((provider) => provider.pluginId));
  }

  getCapabilityProviders(capabilityName: string) {
    return Array.from(this.providers.get(capabilityName) ?? [])
      .map((provider) => ({ ...provider }))
      .sort((left, right) => left.loadOrder - right.loadOrder || left.pluginId.localeCompare(right.pluginId));
  }

  getNodes() {
    return Array.from(this.nodes.values())
      .sort((left, right) => left.loadOrder - right.loadOrder || left.pluginId.localeCompare(right.pluginId))
      .map((node) => ({ ...node }));
  }

  getEdges() {
    const edges = [];

    for (const node of this.getNodes()) {
      for (const consumption of node.consumedCapabilities) {
        const providers = this.getProviderIds(consumption.capability);

        for (const providerId of providers) {
          edges.push({
            from: node.pluginId,
            to: providerId,
            capability: consumption.capability
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
