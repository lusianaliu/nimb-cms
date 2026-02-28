export type HookName = `${string}.${string}.${string}`;

export type HookHandler<TValue = unknown, TContext = Record<string, unknown>> = (
  value: TValue,
  context: TContext
) => TValue | Promise<TValue>;

export type HookRegistrationOptions = {
  pluginId?: string;
};

type RegisteredHook = {
  handler: HookHandler;
  options: HookRegistrationOptions;
};

const HOOK_NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

const validateHookName = (hookName: string) => {
  if (!HOOK_NAME_PATTERN.test(hookName)) {
    throw new Error(
      `Invalid hook name "${hookName}". Hook names must match lifecycle format "domain.action.stage" using lowercase letters, numbers, and dashes.`
    );
  }
};

export class HookRegistry {
  readonly #hooks = new Map<string, RegisteredHook[]>();

  registerHook<TValue = unknown, TContext = Record<string, unknown>>(
    hookName: HookName | string,
    handler: HookHandler<TValue, TContext>,
    options: HookRegistrationOptions = {}
  ): () => void {
    validateHookName(hookName);

    if (typeof handler !== 'function') {
      throw new Error(`Cannot register hook "${hookName}": handler must be a function.`);
    }

    const handlers = this.#hooks.get(hookName) ?? [];
    const registeredHook: RegisteredHook = { handler: handler as HookHandler, options: Object.freeze({ ...options }) };
    handlers.push(registeredHook);
    this.#hooks.set(hookName, handlers);

    return () => {
      const currentHandlers = this.#hooks.get(hookName) ?? [];
      const updatedHandlers = currentHandlers.filter((candidate) => candidate !== registeredHook);

      if (updatedHandlers.length === 0) {
        this.#hooks.delete(hookName);
        return;
      }

      this.#hooks.set(hookName, updatedHandlers);
    };
  }

  register<TValue = unknown, TContext = Record<string, unknown>>(
    hookName: HookName | string,
    handler: HookHandler<TValue, TContext>,
    options: HookRegistrationOptions = {}
  ): () => void {
    return this.registerHook(hookName, handler, options);
  }

  async executeHook<TValue = unknown, TContext = Record<string, unknown>>(
    hookName: HookName | string,
    initialValue: TValue,
    context: TContext
  ): Promise<TValue> {
    validateHookName(hookName);

    let value = initialValue;
    const handlers = this.#hooks.get(hookName) ?? [];

    for (const [index, registered] of handlers.entries()) {
      try {
        value = await registered.handler(value, context);
      } catch (error) {
        const pluginPrefix = registered.options.pluginId ? ` plugin "${registered.options.pluginId}"` : '';
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Hook execution failed for "${hookName}" at handler #${index + 1}${pluginPrefix}: ${message}`
        );
      }
    }

    return value;
  }

  async execute<TValue = unknown, TContext = Record<string, unknown>>(
    hookName: HookName | string,
    initialValue: TValue,
    context: TContext
  ): Promise<TValue> {
    return this.executeHook(hookName, initialValue, context);
  }
}
