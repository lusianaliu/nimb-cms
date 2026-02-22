import { createStructuredError } from '../plugin-runtime/runtime-types.ts';
import { FailureClassifier } from './failure-classifier.ts';
import { RecoveryPlanner, RecoveryStrategy } from './recovery-planner.ts';
import { HealthSnapshot } from './health-snapshot.ts';

export class HealthMonitor {
  constructor(options = {}) {
    this.classifier = options.classifier ?? new FailureClassifier();
    this.planner = options.planner ?? new RecoveryPlanner();
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.retryCounts = new Map();
    this.failureHistory = [];
    this.recoveryHistory = [];
    this.pluginHealth = new Map();
    this.degradedCapabilities = new Map();
    this.recoveryHandlers = options.recoveryHandlers ?? {};
    this.sequence = 0;
  }

  async recordFailure(failure) {
    const category = this.classifier.classify(failure);
    const entry = Object.freeze({
      id: ++this.sequence,
      pluginId: failure.pluginId,
      source: failure.source,
      category,
      capability: failure.capability ?? null,
      eventName: failure.eventName ?? null,
      stateName: failure.stateName ?? null,
      error: createStructuredError(failure.error)
    });

    this.failureHistory.push(entry);
    this.touchPluginHealth(failure.pluginId, 'degraded', entry.id);
    this.diagnosticsChannel?.emit('health:failure', entry);

    const retryKey = `${failure.pluginId}:${failure.source}`;
    const attempts = this.retryCounts.get(retryKey) ?? 0;
    const strategies = this.planner.plan({ ...failure, category }, { attempts });

    for (const strategy of strategies) {
      const recovery = await this.applyStrategy(strategy, failure, { attempts, category });
      if (recovery) {
        this.recoveryHistory.push(recovery);
      }
    }

    return entry;
  }

  async applyStrategy(strategy, failure, context) {
    if (strategy === RecoveryStrategy.RETRY_ACTIVATION) {
      const key = `${failure.pluginId}:${failure.source}`;
      const nextAttempt = (this.retryCounts.get(key) ?? 0) + 1;
      this.retryCounts.set(key, nextAttempt);
      const succeeded = await this.recoveryHandlers.retryActivation?.(failure.pluginId, nextAttempt);
      return this.recordRecovery(strategy, failure.pluginId, { attempt: nextAttempt, succeeded });
    }

    if (strategy === RecoveryStrategy.DISABLE_CAPABILITY_PROVIDER) {
      if (failure.capability) {
        this.degradedCapabilities.set(failure.capability, {
          capability: failure.capability,
          provider: failure.pluginId,
          reason: context.category
        });
      }
      await this.recoveryHandlers.disableCapabilityProvider?.(failure.pluginId, failure.capability);
      return this.recordRecovery(strategy, failure.pluginId, { capability: failure.capability ?? null });
    }

    if (strategy === RecoveryStrategy.DEPENDENCY_CASCADE_STOP) {
      const stopped = await this.recoveryHandlers.dependencyCascadeStop?.(failure.pluginId);
      return this.recordRecovery(strategy, failure.pluginId, { affected: stopped ?? [] });
    }

    if (strategy === RecoveryStrategy.ISOLATE_PLUGIN) {
      await this.recoveryHandlers.isolatePlugin?.(failure.pluginId, context.category);
      this.touchPluginHealth(failure.pluginId, 'isolated', this.sequence);
      return this.recordRecovery(strategy, failure.pluginId, { category: context.category }, true);
    }

    return null;
  }

  recordRecovery(strategy, pluginId, details, isolation = false) {
    const entry = Object.freeze({
      id: ++this.sequence,
      pluginId,
      strategy,
      details: Object.freeze({ ...details })
    });

    this.diagnosticsChannel?.emit(isolation ? 'health:isolation' : 'health:recovery', entry);
    return entry;
  }

  touchPluginHealth(pluginId, status, lastFailureId) {
    const current = this.pluginHealth.get(pluginId) ?? { pluginId, status: 'healthy', failures: 0, lastFailureId: null };
    this.pluginHealth.set(pluginId, {
      ...current,
      status,
      failures: current.failures + 1,
      lastFailureId
    });
  }

  clearPlugin(pluginId) {
    this.retryCounts.delete(`${pluginId}:lifecycle`);
    this.retryCounts.delete(`${pluginId}:capability`);
    this.retryCounts.delete(`${pluginId}:event`);
    this.retryCounts.delete(`${pluginId}:state`);
    this.pluginHealth.delete(pluginId);

    for (const [capability, degraded] of Array.from(this.degradedCapabilities.entries())) {
      if (degraded.provider === pluginId) {
        this.degradedCapabilities.delete(capability);
      }
    }
  }

  snapshot() {
    return HealthSnapshot.from({
      plugins: Array.from(this.pluginHealth.values()).sort((left, right) => left.pluginId.localeCompare(right.pluginId)),
      failures: this.failureHistory,
      recoveryActions: this.recoveryHistory,
      degradedCapabilities: Array.from(this.degradedCapabilities.values()).sort((left, right) => left.capability.localeCompare(right.capability))
    });
  }
}
