import { RuntimeGoal } from './goal.ts';
import { GoalEvaluator } from './goal-evaluator.ts';
import { GoalSnapshot } from './goal-snapshot.ts';

const sortByGoalId = (entries = []) => [...entries].sort((left, right) => left.goalId.localeCompare(right.goalId));

export class GoalEngine {
  constructor(options = {}) {
    this.goalEvaluator = options.goalEvaluator ?? new GoalEvaluator();
    this.runtimeStateProvider = options.runtimeStateProvider ?? (() => null);
    this.reconcilerProvider = options.reconcilerProvider ?? (() => null);
    this.schedulerProvider = options.schedulerProvider ?? (() => null);
    this.emitIntent = options.emitIntent ?? (async () => null);
    this.goals = [];
    this.lastSnapshot = GoalSnapshot.empty();
  }

  register(goalInput) {
    const goal = RuntimeGoal.from(goalInput);
    this.goals = sortByGoalId([
      ...this.goals.filter((entry) => entry.goalId !== goal.goalId),
      goal
    ]);
    return goal;
  }

  registerMany(goals = []) {
    return Object.freeze(goals.map((goal) => this.register(goal)));
  }

  snapshot() {
    return this.lastSnapshot;
  }

  async evaluateCycle() {
    const snapshots = {
      runtimeStateSnapshot: this.runtimeStateProvider(),
      reconcilerSnapshot: this.reconcilerProvider(),
      schedulerSnapshot: this.schedulerProvider()
    };

    const decisions = this.goalEvaluator.evaluateAll(this.goals, snapshots);
    const intents = decisions
      .flatMap((decision) => decision.requiredIntent)
      .sort((left, right) => left.intentId.localeCompare(right.intentId));

    const emittedIntents = [];
    for (const intent of intents) {
      const emitted = await this.emitIntent(intent);
      emittedIntents.push(emitted?.intent ?? intent);
    }

    this.lastSnapshot = GoalSnapshot.from({
      activeGoals: this.goals,
      evaluationResults: decisions,
      emittedIntents
    });

    return this.lastSnapshot;
  }
}
