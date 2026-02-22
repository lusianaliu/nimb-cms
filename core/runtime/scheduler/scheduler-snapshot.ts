const freezeEntries = (entries = []) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class SchedulerSnapshot {
  static from(source = {}) {
    return Object.freeze({
      queue: freezeEntries(source.queue ?? []),
      executed: freezeEntries(source.executed ?? []),
      skipped: freezeEntries(source.skipped ?? []),
      plans: freezeEntries(source.plans ?? [])
    });
  }
}
