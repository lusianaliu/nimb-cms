import { RoutePolicy, RoutingPolicyType } from './route-policy.ts';
import { RouteSelector } from './route-selector.ts';
import { RoutingSnapshot } from './routing-snapshot.ts';

export class CapabilityRouter {
  constructor(options = {}) {
    this.registry = options.registry;
    this.routeSelector = options.routeSelector ?? new RouteSelector();
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.topologyProvider = options.topologyProvider ?? (() => ({ nodes: [], edges: [] }));
    this.isProviderActive = options.isProviderActive ?? (() => true);
    this.policyByCapability = new Map();
    this.decisions = [];
    this.sequence = 0;

    for (const [capabilityName, policy] of Object.entries(options.policies ?? {})) {
      this.setPolicy(capabilityName, policy);
    }
  }

  setPolicy(capabilityName, policy) {
    this.policyByCapability.set(capabilityName, RoutePolicy.from(capabilityName, policy));
  }

  getPolicy(capabilityName) {
    return this.policyByCapability.get(capabilityName) ?? RoutePolicy.from(capabilityName, { type: RoutingPolicyType.SINGLE });
  }

  route({ consumerId, capabilityName, invocationKey = 'default' }) {
    const policy = this.getPolicy(capabilityName);
    const topology = this.topologyProvider();
    const topologyKey = `${topology.nodes.length}:${topology.edges.length}`;

    const compatibleProviders = this.registry
      .listCapabilityProviders(capabilityName)
      .filter((providerId) => this.registry.isVersionCompatible(consumerId, capabilityName, providerId));

    const activeProviders = compatibleProviders.filter((providerId) => this.isProviderActive(providerId));
    const selection = this.routeSelector.select({
      policy,
      capability: capabilityName,
      consumerId,
      invocationKey,
      providers: activeProviders,
      topologyKey
    });

    if (!selection || !selection.selectedProviderId) {
      this.diagnosticsChannel?.emit('routing:rejected', {
        consumerId,
        capability: capabilityName,
        invocationKey,
        policy: policy.type,
        reason: compatibleProviders.length === 0
          ? 'no-compatible-provider'
          : activeProviders.length === 0
            ? 'no-active-provider'
            : 'policy-selection-failed'
      });
      return null;
    }

    const selectedProviderId = selection.selectedProviderId;
    if (policy.type === RoutingPolicyType.FALLBACK && policy.chain?.[0] !== selectedProviderId) {
      this.diagnosticsChannel?.emit('routing:fallback', {
        consumerId,
        capability: capabilityName,
        selectedProviderId,
        chain: policy.chain
      });
    }

    this.diagnosticsChannel?.emit('routing:selected', {
      consumerId,
      capability: capabilityName,
      invocationKey,
      providerId: selectedProviderId,
      policy: policy.type,
      candidates: selection.candidates
    });

    const decision = Object.freeze({
      sequence: ++this.sequence,
      consumerId,
      capability: capabilityName,
      invocationKey,
      providerId: selectedProviderId,
      policy: policy.type,
      candidates: Object.freeze([...selection.candidates]),
      topologyKey
    });

    this.decisions.push(decision);
    return decision;
  }

  snapshot() {
    return RoutingSnapshot.from({ decisions: this.decisions });
  }
}
