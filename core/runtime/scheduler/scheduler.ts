import { ExecutionPlan } from './execution-plan.ts';
import { ScheduleQueue } from './schedule-queue.ts';
import { SchedulerSnapshot } from './scheduler-snapshot.ts';

const normalizeDependencies = (dependencies) => Object.freeze([...(dependencies ?? [])].map((entry) => String(entry)).sort((left, right) => left.localeCompare(right)));

const retryDelay = ({ retryStrategy, attempt, degradedMode }) => {
  const baseDelay = retryStrategy === 'exponential-backoff'
    ? 2 ** Math.max(0, attempt - 1)
    : retryStrategy === 'immediate-once'
      ? 0
      : Number.POSITIVE_INFINITY;

  const pacingDelay = degradedMode ? 1 : 0;
  return baseDelay + pacingDelay;
};

const maxRetries = (retryStrategy) => {
  if (retryStrategy === 'immediate-once') {
    return 1;
  }

  if (retryStrategy === 'exponential-backoff') {
    return 2;
  }

  return 0;
};

export class Scheduler {
  constructor(options = {}) {
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.queue = options.queue ?? new ScheduleQueue();
    this.topologyProvider = options.topologyProvider ?? (() => Object.freeze({ activationOrder: [], edges: [] }));
    this.healthProvider = options.healthProvider ?? (() => Object.freeze({ degradedCapabilities: [] }));
    this.executed = [];
    this.skipped = [];
    this.plans = [];
    this.tick = 0;
  }

  enqueueLifecycle({ pluginId, stage = 'register', loadOrder = null, operation, policyDecision, capability, dependencies = [], priority = 0 }) {
    const topology = this.topologyProvider();
    const activationOrder = Array.isArray(topology.activationOrder) ? topology.activationOrder : [];
    const dependencyOrder = Math.max(0, activationOrder.indexOf(pluginId));
    const normalizedDependencies = normalizeDependencies(dependencies);

    const item = this.queue.enqueue({
      pluginId,
      stage,
      loadOrder,
      operation,
      capability,
      dependencyOrder,
      dependencies: normalizedDependencies,
      priority,
      policyDecision,
      attempt: 0,
      availableAtTick: this.tick
    });

    this.diagnosticsChannel?.emit('scheduler:queued', {
      pluginId,
      stage,
      attempt: item.attempt,
      priority,
      dependencies: [...normalizedDependencies]
    });

    return item.sequence;
  }

  createExecutionPlan() {
    const queued = this.queue.list();
    const executedSet = new Set(this.executed.filter((entry) => entry.status === 'success').map((entry) => entry.pluginId));
    const ready = [];
    const blocked = [];

    for (const entry of queued) {
      if (entry.availableAtTick > this.tick) {
        blocked.push({ pluginId: entry.pluginId, reason: 'scheduled-for-future-tick', tick: entry.availableAtTick });
        continue;
      }

      const unresolved = entry.dependencies.filter((dependency) => !executedSet.has(dependency));
      if (unresolved.length > 0) {
        blocked.push({ pluginId: entry.pluginId, reason: 'awaiting-dependencies', unresolvedDependencies: unresolved });
        continue;
      }

      ready.push(entry);
    }

    const plan = ExecutionPlan.from({ queueEntries: ready, tick: this.tick, blocked });
    this.plans.push({ tick: plan.tick, executable: plan.executable.length, blocked: plan.blocked.length });
    return plan;
  }

  async executeNext(executor) {
    const plan = this.createExecutionPlan();
    const [next] = plan.executable;

    if (!next) {
      this.tick += 1;
      return null;
    }

    this.queue.removeBySequence(next.sequence);

    if (!next.policyDecision?.allowExecution) {
      const skipped = Object.freeze({ pluginId: next.pluginId, stage: next.stage, reason: 'policy-blocked', reasons: [...(next.policyDecision?.reasons ?? [])] });
      this.skipped.push(skipped);
      this.diagnosticsChannel?.emit('scheduler:skipped', {
        pluginId: next.pluginId,
        stage: next.stage,
        reason: skipped.reason,
        reasons: skipped.reasons
      });
      return { ok: false, skipped: true, reasons: skipped.reasons };
    }

    const health = this.healthProvider();
    const degradedMode = next.policyDecision?.degradedMode === true
      || (health.degradedCapabilities ?? []).includes(next.capability);

    const result = await executor(next);
    const executedEntry = Object.freeze({
      pluginId: next.pluginId,
      stage: next.stage,
      attempt: next.attempt,
      status: result.ok ? 'success' : 'failure'
    });

    this.executed.push(executedEntry);
    this.diagnosticsChannel?.emit('scheduler:executed', {
      pluginId: next.pluginId,
      stage: next.stage,
      attempt: next.attempt,
      status: executedEntry.status
    });

    if (!result.ok) {
      const retries = maxRetries(next.policyDecision?.retryStrategy);
      if (next.attempt < retries) {
        const delay = retryDelay({
          retryStrategy: next.policyDecision?.retryStrategy,
          attempt: next.attempt + 1,
          degradedMode
        });

        this.queue.enqueue({
          ...next,
          attempt: next.attempt + 1,
          availableAtTick: this.tick + delay
        });

        this.diagnosticsChannel?.emit('scheduler:queued', {
          pluginId: next.pluginId,
          stage: next.stage,
          attempt: next.attempt + 1,
          priority: next.priority,
          dependencies: [...next.dependencies],
          retryStrategy: next.policyDecision?.retryStrategy
        });
      }
    }

    return result;
  }

  async drain(executor) {
    const outcomes = [];
    while (this.queue.list().length > 0) {
      const outcome = await this.executeNext(executor);
      if (outcome !== null) {
        outcomes.push(outcome);
      }
    }

    return outcomes;
  }

  snapshot() {
    return SchedulerSnapshot.from({
      queue: this.queue.list(),
      executed: this.executed,
      skipped: this.skipped,
      plans: this.plans
    });
  }
}
