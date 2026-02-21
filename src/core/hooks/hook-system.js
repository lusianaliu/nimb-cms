export class HookSystem {
  constructor() {
    this.beforeHooks = new Map();
    this.afterHooks = new Map();
    this.filters = new Map();
  }

  before(hookName, listener) {
    return this.register(this.beforeHooks, hookName, listener);
  }

  after(hookName, listener) {
    return this.register(this.afterHooks, hookName, listener);
  }

  filter(hookName, listener) {
    return this.register(this.filters, hookName, listener);
  }

  async runBefore(hookName, payload) {
    return this.execute(this.beforeHooks, hookName, payload);
  }

  async runAfter(hookName, payload) {
    return this.execute(this.afterHooks, hookName, payload);
  }

  async applyFilters(hookName, initialValue, context) {
    const filterSet = this.filters.get(hookName);
    if (!filterSet) {
      return initialValue;
    }

    let value = initialValue;
    for (const listener of filterSet) {
      value = await Promise.resolve(listener(value, context));
    }

    return value;
  }

  register(store, hookName, listener) {
    if (!store.has(hookName)) {
      store.set(hookName, new Set());
    }

    store.get(hookName).add(listener);
    return () => this.unregister(store, hookName, listener);
  }

  unregister(store, hookName, listener) {
    const hookSet = store.get(hookName);
    if (!hookSet) {
      return;
    }

    hookSet.delete(listener);
    if (hookSet.size === 0) {
      store.delete(hookName);
    }
  }

  async execute(store, hookName, payload) {
    const hookSet = store.get(hookName);
    if (!hookSet) {
      return [];
    }

    const outcomes = [];
    for (const listener of hookSet) {
      try {
        const value = await Promise.resolve(listener(payload));
        outcomes.push({ ok: true, value });
      } catch (error) {
        outcomes.push({ ok: false, error });
      }
    }

    return outcomes;
  }
}
