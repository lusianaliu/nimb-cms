import { deterministicJson } from '../persistence/persistence-snapshot.ts';

const stableEntries = (entries = []) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

const normalizePayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return Object.freeze({});
  }

  return Object.freeze(Object.fromEntries(
    Object.entries(payload)
      .map(([key, value]) => [String(key), value])
      .sort(([left], [right]) => left.localeCompare(right))
  ));
};

const commandFingerprint = (command) => deterministicJson({
  action: command.action,
  payload: command.payload,
  requestId: command.requestId
});

const normalizeCommand = (command = {}) => {
  const action = String(command.action ?? '').trim();
  if (!action) {
    throw new Error('admin command action is required');
  }

  const requestId = String(command.requestId ?? '').trim();
  if (!requestId) {
    throw new Error('admin command requestId is required for deterministic replay');
  }

  return Object.freeze({
    action,
    requestId,
    payload: normalizePayload(command.payload)
  });
};

export class CommandDispatcher {
  constructor({ executor, clock = () => new Date().toISOString(), maxHistory = 32 } = {}) {
    this.executor = executor;
    this.clock = clock;
    this.maxHistory = Number.isFinite(Number(maxHistory)) ? Number(maxHistory) : 32;
    this.replayCache = new Map();
    this.commandHistory = [];
    this.lastCommands = [];
    this.adminHealth = 'idle';
  }

  async dispatch(commandInput) {
    const command = normalizeCommand(commandInput);
    const fingerprint = commandFingerprint(command);

    if (this.replayCache.has(fingerprint)) {
      return this.replayCache.get(fingerprint);
    }

    const startedAt = this.clock();
    const result = await this.executor.execute(command);
    const finishedAt = this.clock();

    const envelope = Object.freeze({
      command,
      startedAt,
      finishedAt,
      fingerprint,
      result: Object.freeze({ ...result })
    });

    this.commandHistory = [...this.commandHistory, envelope].slice(-this.maxHistory);
    this.lastCommands = [...this.commandHistory].slice(-5);
    this.adminHealth = result.success ? 'ok' : 'degraded';
    this.replayCache.set(fingerprint, envelope);

    return envelope;
  }

  status() {
    return Object.freeze({
      lastCommands: stableEntries(this.lastCommands),
      commandHistory: stableEntries(this.commandHistory),
      adminHealth: this.adminHealth
    });
  }
}
