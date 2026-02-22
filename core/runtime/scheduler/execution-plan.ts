const freezeEntries = (entries = []) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class ExecutionPlan {
  static from({ queueEntries = [], tick, blocked = [] } = {}) {
    return Object.freeze({
      tick,
      executable: freezeEntries(queueEntries),
      blocked: freezeEntries(blocked)
    });
  }
}
