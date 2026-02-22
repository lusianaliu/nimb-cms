const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class SandboxSnapshot {
  static from({ executions = [] } = {}) {
    return Object.freeze({
      executions: freezeEntries(executions)
    });
  }
}
