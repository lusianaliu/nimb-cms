const freezeObject = (value = {}) => Object.freeze({ ...value });

export class PolicyContext {
  static from(source = {}) {
    const topology = source.topologySnapshot ?? Object.freeze({
      nodes: Object.freeze([]),
      edges: Object.freeze([]),
      activationOrder: Object.freeze([]),
      unresolvedDependencies: Object.freeze([])
    });

    const health = source.healthSnapshot ?? Object.freeze({
      plugins: Object.freeze([]),
      failures: Object.freeze([]),
      recoveryActions: Object.freeze([]),
      degradedCapabilities: Object.freeze([])
    });

    const version = source.versionResolution ?? Object.freeze({
      resolvedVersions: Object.freeze([]),
      compatibilityWarnings: Object.freeze([]),
      rejectedPlugins: Object.freeze([])
    });

    const routing = source.routingDecision
      ? freezeObject(source.routingDecision)
      : null;

    return Object.freeze({
      pluginId: source.pluginId ?? null,
      capability: source.capability ?? null,
      stage: source.stage ?? 'unknown',
      topologySnapshot: topology,
      healthSnapshot: health,
      routingDecision: routing,
      versionResolution: version
    });
  }
}
