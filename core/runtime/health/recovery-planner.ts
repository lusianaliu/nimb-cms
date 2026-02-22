import { FailureCategory } from './failure-classifier.ts';

export const RecoveryStrategy = Object.freeze({
  RETRY_ACTIVATION: 'retry activation',
  ISOLATE_PLUGIN: 'isolate plugin',
  DISABLE_CAPABILITY_PROVIDER: 'disable capability provider',
  DEPENDENCY_CASCADE_STOP: 'dependency cascade stop'
});

export class RecoveryPlanner {
  constructor(options = {}) {
    this.maxRetryAttempts = options.maxRetryAttempts ?? 2;
  }

  plan(failure, context = {}) {
    const attempts = context.attempts ?? 0;
    const strategies = [];

    if (failure.source === 'lifecycle' && failure.category === FailureCategory.TRANSIENT && attempts < this.maxRetryAttempts) {
      strategies.push(RecoveryStrategy.RETRY_ACTIVATION);
      return strategies;
    }

    if (failure.source === 'capability' && (
      failure.category === FailureCategory.DEPENDENCY_FAILURE ||
      failure.category === FailureCategory.CONTRACT_VIOLATION
    )) {
      strategies.push(RecoveryStrategy.DISABLE_CAPABILITY_PROVIDER);
    }

    if (failure.category === FailureCategory.DEPENDENCY_FAILURE) {
      strategies.push(RecoveryStrategy.DEPENDENCY_CASCADE_STOP);
    }

    strategies.push(RecoveryStrategy.ISOLATE_PLUGIN);
    return Array.from(new Set(strategies));
  }
}
