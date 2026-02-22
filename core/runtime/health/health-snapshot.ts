const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class HealthSnapshot {
  static from(source = {}) {
    return Object.freeze({
      plugins: freezeEntries(source.plugins ?? []),
      failures: freezeEntries(source.failures ?? []),
      recoveryActions: freezeEntries(source.recoveryActions ?? []),
      degradedCapabilities: freezeEntries(source.degradedCapabilities ?? [])
    });
  }
}
