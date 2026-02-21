export class PluginRuntimeContext {
  constructor(options) {
    this.eventBus = options.eventBus;
    this.hooks = options.hooks;
    this.router = options.router;
    this.permissionRegistry = options.permissionRegistry;
    this.blockRegistry = options.blockRegistry;
    this.logger = options.logger;
  }

  on(eventName, listener) {
    return this.eventBus.on(eventName, listener);
  }

  before(hookName, listener) {
    return this.hooks.before(hookName, listener);
  }

  after(hookName, listener) {
    return this.hooks.after(hookName, listener);
  }

  filter(hookName, listener) {
    return this.hooks.filter(hookName, listener);
  }

  registerRoute(handler) {
    return this.router.registerPluginRoute(handler);
  }

  registerPermission(permission) {
    return this.permissionRegistry.register(permission);
  }

  registerBlock(blockDefinition) {
    this.blockRegistry.register(blockDefinition);
  }
}
