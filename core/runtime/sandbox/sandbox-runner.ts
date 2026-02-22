import { createStructuredError } from '../plugin-runtime/runtime-types.ts';
import { ExecutionBoundary } from './execution-boundary.ts';
import { SandboxContext } from './sandbox-context.ts';
import { SandboxSnapshot } from './sandbox-snapshot.ts';

export class SandboxRunner {
  constructor(options = {}) {
    this.diagnosticsChannel = options.diagnosticsChannel;
    this.executionBoundary = options.executionBoundary ?? new ExecutionBoundary();
    this.executions = [];
    this.sequence = 0;
  }

  async executeLifecycle({ pluginId, stage = 'register', loadOrder = null, operation, contracts = {} }) {
    const context = new SandboxContext({
      pluginId,
      stage,
      loadOrder,
      executionId: ++this.sequence
    });

    this.diagnosticsChannel?.emit('sandbox:start', {
      executionId: context.executionId,
      pluginId,
      stage,
      loadOrder
    });

    try {
      const sandboxContracts = this.executionBoundary.createSandboxContracts(contracts);
      const value = await Promise.resolve(operation(sandboxContracts));
      this.executions.push(context.toEntry('success'));
      this.diagnosticsChannel?.emit('sandbox:terminated', {
        executionId: context.executionId,
        pluginId,
        stage,
        result: 'success'
      });
      return { ok: true, value };
    } catch (error) {
      const structured = createStructuredError(error);
      this.executions.push(context.toEntry('failure', { error: structured }));
      this.diagnosticsChannel?.emit('sandbox:error', {
        executionId: context.executionId,
        pluginId,
        stage,
        error: structured
      });
      this.diagnosticsChannel?.emit('sandbox:terminated', {
        executionId: context.executionId,
        pluginId,
        stage,
        result: 'failure'
      });
      return { ok: false, error };
    }
  }

  snapshot() {
    return SandboxSnapshot.from({ executions: this.executions });
  }
}
