export class RuntimeContracts {
  constructor(options) {
    this.logger = options.logger;
    this.capabilities = new Map();
    this.schemas = new Map();
    this.lifecycleHooks = new Map();
  }

  registerCapability(definition) {
    this.capabilities.set(definition.key, definition);
    return () => {
      this.capabilities.delete(definition.key);
    };
  }

  registerSchema(definition) {
    this.schemas.set(definition.id, definition);
    return () => {
      this.schemas.delete(definition.id);
    };
  }

  registerLifecycleHook(definition) {
    const hookKey = `${definition.source}:${definition.name}:${definition.order}`;
    this.lifecycleHooks.set(hookKey, definition);
    return () => {
      this.lifecycleHooks.delete(hookKey);
    };
  }

  createContractSurface() {
    return {
      registerCapability: (definition) => this.registerCapability(definition),
      registerSchema: (definition) => this.registerSchema(definition),
      registerLifecycleHook: (definition) => this.registerLifecycleHook(definition),
      useCapability: () => {
        throw new Error('useCapability is provided by runtime context only');
      },
      logger: this.logger
    };
  }
}
