import { RuntimeIntent } from './intent.ts';
import { IntentPlanner } from './intent-planner.ts';
import { OrchestratorSnapshot } from './orchestrator-snapshot.ts';

export class Orchestrator {
  constructor(options = {}) {
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.scheduler = options.scheduler;
    this.policyEngine = options.policyEngine;
    this.intentPlanner = options.intentPlanner ?? new IntentPlanner({
      topologyProvider: options.topologyProvider,
      policyEngine: this.policyEngine
    });

    this.pendingIntents = [];
    this.lastPlans = [];
    this.status = {
      state: 'idle',
      lastIntentId: null,
      pendingCount: 0
    };
  }

  async intent(input) {
    const intent = RuntimeIntent.from(input);
    this.pendingIntents.push(intent);
    this.pendingIntents.sort((left, right) => left.intentId.localeCompare(right.intentId));

    this.status = {
      state: 'planning',
      lastIntentId: intent.intentId,
      pendingCount: this.pendingIntents.length
    };

    this.diagnosticsChannel?.emit('orchestrator:intent:accepted', {
      intentId: intent.intentId,
      type: intent.type,
      targetPlugins: [...intent.targetPlugins]
    });

    const steps = this.intentPlanner.plan(intent);
    this.lastPlans = [
      ...this.lastPlans.filter((entry) => entry.intentId !== intent.intentId),
      Object.freeze({ intentId: intent.intentId, steps })
    ].sort((left, right) => left.intentId.localeCompare(right.intentId));

    for (const step of steps) {
      this.scheduler?.enqueueLifecycle?.({
        pluginId: step.pluginId,
        stage: step.stage,
        operation: () => null,
        policyDecision: step.policyDecision,
        dependencies: step.dependencies,
        priority: step.priority
      });
    }

    this.pendingIntents = this.pendingIntents.filter((entry) => entry.intentId !== intent.intentId);
    this.status = {
      state: 'queued',
      lastIntentId: intent.intentId,
      pendingCount: this.pendingIntents.length
    };

    this.diagnosticsChannel?.emit('orchestrator:intent:planned', {
      intentId: intent.intentId,
      steps: steps.length
    });

    return Object.freeze({ intent, steps });
  }

  snapshot() {
    return OrchestratorSnapshot.from({
      pendingIntents: this.pendingIntents,
      lastPlans: this.lastPlans,
      orchestrationStatus: this.status
    });
  }
}
