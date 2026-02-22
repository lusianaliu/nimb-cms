export class SandboxContext {
  constructor(options = {}) {
    this.pluginId = options.pluginId;
    this.stage = options.stage ?? 'register';
    this.loadOrder = options.loadOrder ?? null;
    this.executionId = options.executionId;
    this.startedAt = options.startedAt ?? Date.now();
  }

  toEntry(status, details = {}) {
    return Object.freeze({
      executionId: this.executionId,
      pluginId: this.pluginId,
      stage: this.stage,
      loadOrder: this.loadOrder,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      status,
      ...details
    });
  }
}
