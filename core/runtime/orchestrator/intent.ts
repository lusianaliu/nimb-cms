export const RuntimeIntentType = Object.freeze({
  ACTIVATE_PLUGIN: 'ACTIVATE_PLUGIN',
  DEACTIVATE_PLUGIN: 'DEACTIVATE_PLUGIN',
  RESTART_PLUGIN: 'RESTART_PLUGIN',
  RECONCILE_RUNTIME: 'RECONCILE_RUNTIME'
});

const sortStrings = (values = []) => [...new Set(values.map((value) => String(value)))].sort((left, right) => left.localeCompare(right));

const normalizeDesiredState = (desiredState) => {
  if (!desiredState || typeof desiredState !== 'object' || Array.isArray(desiredState)) {
    return Object.freeze({});
  }

  return Object.freeze(Object.fromEntries(
    Object.entries(desiredState)
      .map(([key, value]) => [String(key), value])
      .sort(([left], [right]) => left.localeCompare(right))
  ));
};

const normalizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return Object.freeze({});
  }

  return Object.freeze(Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [String(key), value])
      .sort(([left], [right]) => left.localeCompare(right))
  ));
};

export class RuntimeIntent {
  static from(input = {}) {
    const intentType = String(input.type ?? '').trim();
    if (!Object.values(RuntimeIntentType).includes(intentType)) {
      throw new Error(`unsupported runtime intent type: ${intentType || '<empty>'}`);
    }

    const intentId = String(input.intentId ?? '').trim();
    if (!intentId) {
      throw new Error('runtime intent requires a deterministic intentId');
    }

    return Object.freeze({
      intentId,
      type: intentType,
      targetPlugins: Object.freeze(sortStrings(input.targetPlugins ?? [])),
      desiredState: normalizeDesiredState(input.desiredState),
      priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
      metadata: normalizeMetadata(input.metadata)
    });
  }
}
