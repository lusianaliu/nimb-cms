import { PluginRuntime } from '../runtime/plugin-runtime/lifecycle-runner.ts';
import { DiagnosticsChannel, EventTrace, CapabilityTrace, StateTrace } from '../runtime/observability/index.ts';
import { Scheduler } from '../runtime/scheduler/index.ts';
import { Reconciler, ReconcileLoop } from '../runtime/reconciler/index.ts';
import { Orchestrator } from '../runtime/orchestrator/index.ts';
import { GoalEngine } from '../runtime/goals/index.ts';

export const createRuntime = (config, project) => {
  const diagnosticsChannel = new DiagnosticsChannel();
  const eventTrace = new EventTrace({ diagnosticsChannel });
  const capabilityTrace = new CapabilityTrace({ diagnosticsChannel });
  const stateTrace = new StateTrace({ diagnosticsChannel });

  const scheduler = new Scheduler({ diagnosticsChannel });
  const reconciler = new Reconciler({ diagnosticsChannel, schedulerProvider: () => scheduler.snapshot() });
  const reconcileLoop = new ReconcileLoop({ diagnosticsChannel, scheduler, reconciler });
  const orchestrator = new Orchestrator({ diagnosticsChannel, scheduler });
  const goalEngine = new GoalEngine({
    schedulerProvider: () => scheduler.snapshot(),
    reconcilerProvider: () => reconciler.snapshot()
  });

  const runtime = new PluginRuntime({
    diagnosticsChannel,
    eventTrace,
    capabilityTrace,
    stateTrace,
    scheduler,
    reconciler,
    reconcileLoop,
    orchestrator,
    goalEngine,
    pluginsDirectory: config?.pluginsDirectory ?? project?.pluginsDir ?? project?.pluginsDirectory
  });

  return runtime;
};
