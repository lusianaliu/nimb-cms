const CORE_HOOKS = Object.freeze([
  'system.start',
  'routes.register',
  'admin.menu',
  'admin.page',
  'editor.extend',
  'content-type.register'
] as const);

type HookHandler = (...args: unknown[]) => unknown | Promise<unknown>;

type RegisteredHook = {
  handler: HookHandler;
};

const assertHookName = (name: string) => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('hook name must be a non-empty string');
  }
};

const assertHookHandler = (handler: HookHandler) => {
  if (typeof handler !== 'function') {
    throw new Error('hook handler must be a function');
  }
};

export type PluginHookSystem = {
  readonly supportedHooks: readonly string[];
  registerHook: (name: string, handler: HookHandler) => () => void;
  run: (name: string, ...args: unknown[]) => Promise<void>;
  register: (name: string, handler: HookHandler) => () => void;
  execute: (name: string, initialValue: unknown, context?: Record<string, unknown>) => Promise<unknown>;
};

export const createHookSystem = (): PluginHookSystem => {
  const hooks = new Map<string, RegisteredHook[]>();

  const registerHook = (name: string, handler: HookHandler) => {
    assertHookName(name);
    assertHookHandler(handler);

    const registered: RegisteredHook = { handler };
    const current = hooks.get(name) ?? [];
    current.push(registered);
    hooks.set(name, current);

    return () => {
      const existing = hooks.get(name) ?? [];
      const next = existing.filter((entry) => entry !== registered);

      if (next.length === 0) {
        hooks.delete(name);
        return;
      }

      hooks.set(name, next);
    };
  };

  const run = async (name: string, ...args: unknown[]) => {
    assertHookName(name);
    const handlers = hooks.get(name) ?? [];

    for (const registered of handlers) {
      await registered.handler(...args);
    }
  };

  const execute = async (name: string, initialValue: unknown, context: Record<string, unknown> = {}) => {
    assertHookName(name);
    let value = initialValue;
    const handlers = hooks.get(name) ?? [];

    for (const registered of handlers) {
      value = await registered.handler(value, context);
    }

    return value;
  };

  return Object.freeze({
    supportedHooks: CORE_HOOKS,
    registerHook,
    run,
    register: registerHook,
    execute
  });
};
