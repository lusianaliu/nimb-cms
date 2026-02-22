const freezeEntries = (entries = []) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class ReconcileSnapshot {
  static from({ cycle = 0, stable = true, drift = [], actions = [] } = {}) {
    return Object.freeze({
      cycle,
      stable,
      drift: freezeEntries(drift),
      actions: freezeEntries(actions)
    });
  }
}
