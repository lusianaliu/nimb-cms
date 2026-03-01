export const PLUGIN_API_VERSION = '1.0.0';

export interface ScopedRuntime {
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

