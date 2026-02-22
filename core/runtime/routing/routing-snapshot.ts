const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class RoutingSnapshot {
  static from({ decisions }) {
    return Object.freeze({
      decisions: freezeEntries(decisions)
    });
  }
}
