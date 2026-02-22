const freezeEntries = (entries = []) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class OrchestratorSnapshot {
  static empty() {
    return OrchestratorSnapshot.from({ pendingIntents: [], lastPlans: [], orchestrationStatus: { state: 'idle', pendingCount: 0 } });
  }

  static from({ pendingIntents = [], lastPlans = [], orchestrationStatus = {} } = {}) {
    const normalizedStatus = Object.freeze({
      state: String(orchestrationStatus.state ?? 'idle'),
      lastIntentId: orchestrationStatus.lastIntentId ? String(orchestrationStatus.lastIntentId) : null,
      pendingCount: Number.isFinite(Number(orchestrationStatus.pendingCount)) ? Number(orchestrationStatus.pendingCount) : 0
    });

    const plans = lastPlans.map((plan) => ({
      intentId: String(plan.intentId),
      steps: Object.freeze((plan.steps ?? []).map((step) => Object.freeze({
        intentId: String(step.intentId),
        type: String(step.type),
        pluginId: String(step.pluginId),
        stage: String(step.stage),
        priority: Number(step.priority ?? 0),
        dependencies: Object.freeze([...(step.dependencies ?? [])]),
        policyDecision: Object.freeze({
          allowExecution: Boolean(step.policyDecision?.allowExecution),
          degradedMode: Boolean(step.policyDecision?.degradedMode),
          retryStrategy: String(step.policyDecision?.retryStrategy ?? 'none'),
          reasons: Object.freeze([...(step.policyDecision?.reasons ?? [])])
        }),
        metadata: Object.freeze({ ...(step.metadata ?? {}) })
      })))
    }));

    return Object.freeze({
      pendingIntents: freezeEntries(pendingIntents),
      lastPlans: freezeEntries(plans),
      orchestrationStatus: normalizedStatus
    });
  }
}
