const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class PolicySnapshot {
  static from({ evaluations = [] } = {}) {
    return Object.freeze({
      evaluations: freezeEntries(evaluations)
    });
  }
}
