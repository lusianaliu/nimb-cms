import type { HookRegistry } from '../hooks/index.ts';
import type { PluginContext } from './plugin-context.ts';

export interface NimbRuntime {
  hooks: HookRegistry;
}

export interface NimbPlugin {
  name: string;
  setup(context: PluginContext): void | Promise<void>;
}
