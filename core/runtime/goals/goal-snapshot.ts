const freezeEntries = (entries = []) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class GoalSnapshot {
  static empty() {
    return GoalSnapshot.from();
  }

  static from({ activeGoals = [], evaluationResults = [], emittedIntents = [] } = {}) {
    return Object.freeze({
      activeGoals: freezeEntries(activeGoals),
      evaluationResults: freezeEntries(evaluationResults),
      emittedIntents: freezeEntries(emittedIntents)
    });
  }
}
