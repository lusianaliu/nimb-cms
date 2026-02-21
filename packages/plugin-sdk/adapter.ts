import type {
  CapabilityDefinition,
  CapabilityProviderFactory,
  LifecycleDefinition,
  PluginContext,
  RuntimeContracts,
  SchemaDefinition,
  SDKPlugin
} from './types.ts';

const CONTRACT_VERSIONS = Object.freeze({
  'plugin.registerCapability': '^1.0.0',
  'plugin.unregisterCapability': '^1.0.0',
  'plugin.registerSchema': '^1.0.0',
  'plugin.unregisterSchema': '^1.0.0',
  'plugin.registerLifecycleHook': '^1.0.0',
  'plugin.useCapability': '^1.0.0'
});

const assertRuntimeContract = <K extends keyof RuntimeContracts>(
  contracts: Partial<RuntimeContracts>,
  key: K,
  pluginId: string
): asserts contracts is RuntimeContracts => {
  if (key === 'logger') {
    if (!contracts.logger || typeof contracts.logger.info !== 'function') {
      throw new Error(`[${pluginId}] missing required platform contract: logger`);
    }

    return;
  }

  if (typeof contracts[key] !== 'function') {
    throw new Error(`[${pluginId}] missing required platform contract: ${String(key)}`);
  }
};

const registerCapabilities = (
  pluginId: string,
  capabilities: readonly CapabilityDefinition[],
  contracts: RuntimeContracts
): Array<() => void> => {
  return capabilities.map((capability) => contracts.registerCapability({ ...capability, source: pluginId }));
};

const registerSchemas = (
  pluginId: string,
  schemas: readonly SchemaDefinition[],
  contracts: RuntimeContracts
): Array<() => void> => {
  return schemas.map((schema) => contracts.registerSchema({ ...schema, source: pluginId }));
};

const registerRuntimeHooks = (
  pluginId: string,
  context: PluginContext,
  lifecycle: LifecycleDefinition | undefined,
  contracts: RuntimeContracts
): Array<() => void> => {
  if (!lifecycle?.hooks?.length) {
    return [];
  }

  return lifecycle.hooks.map((hook, index) => contracts.registerLifecycleHook({
    name: hook.name,
    order: hook.order ?? index,
    source: pluginId,
    handler: async (event) => {
      await hook.handler(event, context);
    }
  }));
};

export const createRuntimeCompatiblePlugin = (input: {
  name: string;
  version: string;
  capabilities: readonly CapabilityDefinition[];
  exportedCapabilities: Record<string, CapabilityProviderFactory>;
  schemas: readonly SchemaDefinition[];
  lifecycle?: LifecycleDefinition;
}): SDKPlugin => {
  const pluginId = input.name;

  return {
    pluginManifest: {
      id: pluginId,
      version: input.version,
      entrypoints: {
        register: './register.ts'
      },
      declaredCapabilities: input.capabilities.map((capability) => capability.key),
      exportedCapabilities: { ...input.exportedCapabilities },
      requiredPlatformContracts: CONTRACT_VERSIONS
    },
    register: async (contracts: Partial<RuntimeContracts>) => {
      assertRuntimeContract(contracts, 'registerCapability', pluginId);
      assertRuntimeContract(contracts, 'registerSchema', pluginId);
      assertRuntimeContract(contracts, 'registerLifecycleHook', pluginId);
      assertRuntimeContract(contracts, 'useCapability', pluginId);
      assertRuntimeContract(contracts, 'logger', pluginId);

      const context: PluginContext = {
        pluginId,
        pluginVersion: input.version,
        useCapability: contracts.useCapability,
        logger: contracts.logger
      };

      const disposers: Array<() => void> = [];
      disposers.push(...registerCapabilities(pluginId, input.capabilities, contracts));
      disposers.push(...registerSchemas(pluginId, input.schemas, contracts));
      disposers.push(...registerRuntimeHooks(pluginId, context, input.lifecycle, contracts));

      if (input.lifecycle?.onStart) {
        await input.lifecycle.onStart(context);
      }

      return async () => {
        if (input.lifecycle?.onStop) {
          await input.lifecycle.onStop(context);
        }

        for (const dispose of disposers.reverse()) {
          dispose();
        }
      };
    }
  };
};
