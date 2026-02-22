import { PluginState } from '../plugin-runtime/runtime-types.ts';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const assertCapabilityInterface = (value, capabilityName) => {
  if (!isRecord(value)) {
    throw new Error(`capability "${capabilityName}" must resolve to an object interface`);
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new Error(`capability "${capabilityName}" must expose at least one method`);
  }

  for (const [key, member] of entries) {
    if (typeof member !== 'function') {
      throw new Error(`capability "${capabilityName}" member "${key}" must be a function`);
    }
  }
};

export class CapabilityResolver {
  constructor(options) {
    this.registry = options.registry;
    this.logger = options.logger;
    this.interfaceFactories = new Map();
    this.cache = new Map();
    this.capabilityTrace = options.capabilityTrace;
  }

  bindProvider(pluginId, capabilityName, interfaceFactory) {
    if (typeof interfaceFactory !== 'function') {
      throw new Error(`capability "${capabilityName}" provider must be a function`);
    }

    this.interfaceFactories.set(`${pluginId}:${capabilityName}`, interfaceFactory);
    this.cache.delete(capabilityName);
  }

  unbindProvider(pluginId) {
    for (const providerKey of Array.from(this.interfaceFactories.keys())) {
      if (providerKey.startsWith(`${pluginId}:`)) {
        this.interfaceFactories.delete(providerKey);
      }
    }

    this.cache.clear();
  }

  createConsumer(pluginId) {
    return {
      useCapability: (capabilityName) => this.resolveForConsumer(pluginId, capabilityName)
    };
  }

  resolveForConsumer(consumerId, capabilityName) {
    const cached = this.cache.get(capabilityName);
    if (cached && this.isProviderActive(cached.providerId)) {
      return cached.interface;
    }

    const providerId = this.registry.resolveCapabilityProvider(capabilityName);
    if (!providerId) {
      throw new Error(`[${consumerId}] capability provider not found: ${capabilityName}`);
    }

    const factory = this.interfaceFactories.get(`${providerId}:${capabilityName}`);
    if (!factory) {
      throw new Error(`[${consumerId}] capability provider unavailable: ${capabilityName}`);
    }

    const providerRecord = this.registry.require(providerId);
    const rawInterface = factory({
      capability: capabilityName,
      providerId,
      manifest: providerRecord.manifest
    });

    assertCapabilityInterface(rawInterface, capabilityName);
    this.capabilityTrace?.recordResolution(capabilityName, providerId, consumerId);
    const guarded = this.createGuardedInterface(consumerId, providerId, capabilityName, rawInterface);
    this.cache.set(capabilityName, { providerId, interface: guarded });
    return guarded;
  }

  createGuardedInterface(consumerId, providerId, capabilityName, rawInterface) {
    const guardedEntries = Object.entries(rawInterface).map(([key, member]) => {
      return [
        key,
        async (...args) => {
          if (!this.isProviderActive(providerId)) {
            throw new Error(`[${consumerId}] capability provider is inactive: ${capabilityName}`);
          }

          try {
            const result = await Promise.resolve(member(...args));
            this.capabilityTrace?.recordInvocation(capabilityName, providerId, consumerId, true);
            return result;
          } catch (error) {
            this.capabilityTrace?.recordInvocation(capabilityName, providerId, consumerId, false);
            this.logger?.error?.('plugin.runtime.capability.failure', {
              capability: capabilityName,
              provider: providerId,
              consumer: consumerId,
              member: key,
              error: {
                message: error instanceof Error ? error.message : String(error)
              }
            });
            throw error;
          }
        }
      ];
    });

    return Object.freeze(Object.fromEntries(guardedEntries));
  }

  isProviderActive(pluginId) {
    return this.registry.get(pluginId)?.state === PluginState.ACTIVE;
  }
}
