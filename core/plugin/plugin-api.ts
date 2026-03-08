export const PLUGIN_API_VERSION = '1.0.0';

export interface ScopedRuntime {
  contentTypes: {
    register: (definition: { name: string; slug: string; fields: Array<{ name: string; type: string; required?: boolean }> }) => void
    get: (slug: string) => unknown
    list: () => unknown[]
  }
  fieldTypes: {
    register: (type: {
      name: string;
      validate: (value: unknown) => boolean;
      serialize: (value: unknown) => unknown;
      deserialize: (value: unknown) => unknown;
      default?: unknown;
    }) => unknown
    get: (name: string) => unknown
    list: () => unknown[]
  }
  db: {
    create: (type: string, data: Record<string, unknown>) => unknown
    get: (type: string, id: string) => unknown
    update: (type: string, id: string, data: Record<string, unknown>) => unknown
    delete: (type: string, id: string) => unknown
    list: (type: string, options?: Record<string, unknown>) => unknown
    query: (type: string, options?: Record<string, unknown>) => unknown
  }
  http: {
    registerRoute: (method: string, routePath: string, handler: (request: unknown, response: unknown) => unknown) => void
    register: (route: { method: string; path: string; handler: (context: unknown) => unknown }) => void
  }
  admin: {
    navRegistry: {
      register: (item: { id: string; label: string; path: string; order?: number; capability?: string }) => void
      list: () => Array<{ id: string; label: string; path: string; order?: number; capability?: string }>
    }

    middleware: {
      use: (middleware: import('../http/middleware.ts').Middleware) => void
      list: () => import('../http/middleware.ts').Middleware[]
    }
  }
  events: {
    on: (eventName: string, handler: (payload: unknown, context: { pluginId: string; timestamp: string }) => unknown) => () => void
    off: (eventName: string, handler: (payload: unknown, context: { pluginId: string; timestamp: string }) => unknown) => void
    emit: (eventName: string, payload: unknown) => Promise<void>
  }
  hooks: {
    register: (hookName: string, handler: (value: unknown, context: Record<string, unknown>) => unknown | Promise<unknown>) => () => void
    execute: (hookName: string, initialValue: unknown, context: Record<string, unknown>) => Promise<unknown>
  }
  settings: {
    get: (key: string, fallback?: unknown) => unknown
    set: (key: string, value: unknown) => unknown
  }
  capabilities: readonly string[]
  plugins: {
    get: (id: string) => unknown
    list: () => unknown[]
  }
}

export interface PluginAPI {
  version: string
  runtime: ScopedRuntime
}
