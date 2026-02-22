const defaultPolicy = Object.freeze({ allowExecution: true, degradedMode: false, retryStrategy: 'none', reasons: Object.freeze([]) });

export class ReconcileLoop {
  constructor(options = {}) {
    this.reconciler = options.reconciler;
    this.scheduler = options.scheduler;
    this.diagnosticsChannel = options.diagnosticsChannel;
  }

  async runAfterSchedulerCycle({ executeAction, policyDecision = defaultPolicy } = {}) {
    if (!this.reconciler || !this.scheduler) {
      return Object.freeze({ cycle: 0, drift: Object.freeze([]), actions: Object.freeze([]) });
    }

    const plan = this.reconciler.reconcile();
    for (const action of plan.actions) {
      this.scheduler.enqueueLifecycle({
        pluginId: action.pluginId,
        stage: 'reconcile',
        operation: () => executeAction?.(action),
        policyDecision,
        dependencies: [],
        priority: 0
      });
    }

    if (plan.actions.length > 0) {
      await this.scheduler.drain(async (entry) => {
        try {
          const value = await entry.operation();
          return { ok: true, value };
        } catch (error) {
          return { ok: false, error };
        }
      });
    }

    return plan;
  }
}
