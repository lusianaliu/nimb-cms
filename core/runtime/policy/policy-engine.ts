import { PolicyContext } from './policy-context.ts';
import { PolicyEvaluator } from './policy-evaluator.ts';
import { PolicySnapshot } from './policy-snapshot.ts';

export class PolicyEngine {
  constructor(options = {}) {
    this.evaluator = options.evaluator ?? new PolicyEvaluator();
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.contextProviders = {
      topologySnapshot: options.topologySnapshot ?? (() => Object.freeze({ nodes: [], edges: [] })),
      healthSnapshot: options.healthSnapshot ?? (() => Object.freeze({ failures: [], degradedCapabilities: [] })),
      versionResolution: options.versionResolution ?? (() => Object.freeze({ rejectedPlugins: [] }))
    };
    this.evaluations = [];
    this.sequence = 0;
  }

  evaluate(input = {}) {
    const context = PolicyContext.from({
      ...input,
      topologySnapshot: input.topologySnapshot ?? this.contextProviders.topologySnapshot(),
      healthSnapshot: input.healthSnapshot ?? this.contextProviders.healthSnapshot(),
      versionResolution: input.versionResolution ?? this.contextProviders.versionResolution()
    });
    const decision = this.evaluator.evaluate(context);
    const evaluation = Object.freeze({
      sequence: ++this.sequence,
      pluginId: context.pluginId,
      stage: context.stage,
      capability: context.capability,
      allowExecution: decision.allowExecution,
      degradedMode: decision.degradedMode,
      fallbackEnforced: decision.fallback.enforced,
      retryStrategy: decision.retryStrategy,
      reasons: Object.freeze([...decision.reasons])
    });

    this.evaluations.push(evaluation);
    this.diagnosticsChannel?.emit('policy:evaluated', {
      pluginId: evaluation.pluginId,
      stage: evaluation.stage,
      allowExecution: evaluation.allowExecution,
      retryStrategy: evaluation.retryStrategy,
      reasons: [...evaluation.reasons]
    });

    if (!evaluation.allowExecution) {
      this.diagnosticsChannel?.emit('policy:blocked', {
        pluginId: evaluation.pluginId,
        stage: evaluation.stage,
        reasons: [...evaluation.reasons]
      });
    }

    if (evaluation.degradedMode) {
      this.diagnosticsChannel?.emit('policy:degraded', {
        pluginId: evaluation.pluginId,
        stage: evaluation.stage,
        retryStrategy: evaluation.retryStrategy
      });
    }

    return decision;
  }

  snapshot() {
    return PolicySnapshot.from({ evaluations: this.evaluations });
  }
}
