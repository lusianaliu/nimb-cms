import type { HookRegistry } from '../hooks/index.ts';

export interface NimbRuntime {
  hooks: HookRegistry;
}

export interface NimbPlugin {
  name: string;
  setup(runtime: NimbRuntime): void | Promise<void>;
}
