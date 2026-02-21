export class BlockRegistry {
  constructor() {
    this.blocks = new Map();
  }

  register(definition) {
    const type = definition?.type;
    if (!type || typeof type !== 'string') {
      throw new Error('Block definition type is required');
    }

    if (!definition.schema || typeof definition.schema !== 'object') {
      throw new Error(`Block schema is required for type: ${type}`);
    }

    this.blocks.set(type, Object.freeze({
      type,
      schema: definition.schema,
      version: definition.version ?? 1
    }));
  }

  get(type) {
    return this.blocks.get(type) ?? null;
  }

  has(type) {
    return this.blocks.has(type);
  }

  list() {
    return Array.from(this.blocks.values());
  }
}
