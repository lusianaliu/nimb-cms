import type { HookRegistry } from '../hooks/index.ts';
import type { PluginConfig } from './plugin-config.ts';
import type { NimbRuntime } from './plugin.ts';

export interface PluginContext {
  config: PluginConfig;
  hooks: HookRegistry;
  log: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
}

const withPluginPrefix = (pluginName: string, message: string): string => `[plugin:${pluginName}] ${message}`;

export const createPluginContext = (runtime: NimbRuntime, pluginName: string, config: PluginConfig): PluginContext => ({
  config,
  hooks: runtime.hooks,
  log: {
    info(message: string) {
      console.info(withPluginPrefix(pluginName, message));
    },
    warn(message: string) {
      console.warn(withPluginPrefix(pluginName, message));
    },
    error(message: string) {
      console.error(withPluginPrefix(pluginName, message));
    }
  }
});
