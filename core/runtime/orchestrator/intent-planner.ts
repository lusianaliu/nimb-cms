import { RuntimeIntentType } from './intent.ts';

const toSortedUnique = (values = []) => [...new Set(values.map((value) => String(value)))].sort((left, right) => left.localeCompare(right));

const buildGraph = (topologySnapshot = {}) => {
  const edges = Array.isArray(topologySnapshot.edges) ? topologySnapshot.edges : [];
  const dependenciesByPlugin = new Map();
  const dependentsByPlugin = new Map();

  for (const edge of edges) {
    const from = String(edge.from);
    const to = String(edge.to);

    if (!dependenciesByPlugin.has(from)) {
      dependenciesByPlugin.set(from, new Set());
    }
    dependenciesByPlugin.get(from).add(to);

    if (!dependentsByPlugin.has(to)) {
      dependentsByPlugin.set(to, new Set());
    }
    dependentsByPlugin.get(to).add(from);
  }

  return { dependenciesByPlugin, dependentsByPlugin };
};

const collectWithGraph = (roots, graphMap) => {
  const visited = new Set();
  const ordered = [];

  const visit = (pluginId) => {
    if (visited.has(pluginId)) {
      return;
    }

    visited.add(pluginId);
    const neighbors = toSortedUnique(Array.from(graphMap.get(pluginId) ?? []));
    for (const neighbor of neighbors) {
      visit(neighbor);
    }
    ordered.push(pluginId);
  };

  for (const pluginId of toSortedUnique(roots)) {
    visit(pluginId);
  }

  return ordered;
};

export class IntentPlanner {
  constructor(options = {}) {
    this.topologyProvider = options.topologyProvider ?? (() => Object.freeze({ nodes: [], edges: [], activationOrder: [] }));
    this.policyEngine = options.policyEngine;
  }

  plan(intent) {
    const topologySnapshot = this.topologyProvider();
    const { dependenciesByPlugin, dependentsByPlugin } = buildGraph(topologySnapshot);
    const nodeIds = toSortedUnique((topologySnapshot.nodes ?? []).map((node) => node.pluginId));

    const roots = intent.type === RuntimeIntentType.RECONCILE_RUNTIME
      ? toSortedUnique(topologySnapshot.activationOrder?.length ? topologySnapshot.activationOrder : nodeIds)
      : intent.targetPlugins;

    const activationOrder = collectWithGraph(roots, dependenciesByPlugin);
    const deactivationOrder = collectWithGraph(roots, dependentsByPlugin).reverse();

    const selectedOrder = intent.type === RuntimeIntentType.DEACTIVATE_PLUGIN
      ? deactivationOrder
      : activationOrder;

    const stages = intent.type === RuntimeIntentType.RESTART_PLUGIN
      ? Object.freeze(['deactivate', 'activate'])
      : Object.freeze([
          intent.type === RuntimeIntentType.DEACTIVATE_PLUGIN
            ? 'deactivate'
            : intent.type === RuntimeIntentType.RECONCILE_RUNTIME
              ? 'reconcile'
              : 'activate'
        ]);

    const plan = [];
    for (const stage of stages) {
      for (const pluginId of selectedOrder) {
        const dependencies = stage === 'activate' || stage === 'reconcile'
          ? toSortedUnique(Array.from(dependenciesByPlugin.get(pluginId) ?? []))
          : toSortedUnique(Array.from(dependentsByPlugin.get(pluginId) ?? []));
        const policyDecision = this.policyEngine?.evaluate?.({
          pluginId,
          stage: `orchestrator:${stage}`,
          capability: null,
          routingDecision: {
            required: false,
            policy: 'single',
            providerId: pluginId,
            candidates: [pluginId]
          }
        }) ?? Object.freeze({ allowExecution: true, degradedMode: false, retryStrategy: 'none', reasons: Object.freeze([]) });

        plan.push(Object.freeze({
          intentId: intent.intentId,
          type: intent.type,
          pluginId,
          stage,
          priority: intent.priority,
          dependencies: Object.freeze(dependencies),
          policyDecision: Object.freeze({
            allowExecution: policyDecision.allowExecution,
            degradedMode: policyDecision.degradedMode,
            retryStrategy: policyDecision.retryStrategy,
            reasons: Object.freeze([...(policyDecision.reasons ?? [])])
          }),
          metadata: intent.metadata
        }));
      }
    }

    return Object.freeze(plan);
  }
}
