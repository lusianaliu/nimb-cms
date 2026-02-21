import { createRuntimeCompatiblePlugin } from './adapter.ts';
import { validatePluginDefinition } from './validation.ts';
import type {
  CapabilityDefinition,
  CapabilityInterface,
  CapabilityProviderFactory,
  LifecycleDefinition,
  PluginContext,
  PluginDefinition,
  RuntimeLifecycleDefinition,
  RuntimeLifecycleEvent,
  SchemaDefinition,
  SDKPlugin
} from './types.ts';

export type {
  CapabilityDefinition,
  CapabilityInterface,
  CapabilityProviderFactory,
  LifecycleDefinition,
  PluginContext,
  PluginDefinition,
  RuntimeLifecycleDefinition,
  RuntimeLifecycleEvent,
  SchemaDefinition,
  SDKPlugin
};

/**
 * Architectural intent:
 * definePlugin is a thin authoring facade that compiles declarative input into
 * the existing runtime manifest/register contracts without touching runtime internals.
 */
export const definePlugin = (definition: PluginDefinition): SDKPlugin => {
  validatePluginDefinition(definition);

  return createRuntimeCompatiblePlugin({
    name: definition.name,
    version: definition.version,
    capabilities: definition.capabilities ?? [],
    exportedCapabilities: definition.exportedCapabilities ?? {},
    schemas: definition.schemas ?? [],
    lifecycle: definition.lifecycle
  });
};
