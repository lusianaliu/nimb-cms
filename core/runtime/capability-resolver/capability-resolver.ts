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
    this.providerInterfaces = new Map();
    this.capabilityTrace = options.capabilityTrace;
    this.healthReporter = options.healthReporter;
    this.router = options.router;
  }

  bindProvider(pluginId, capabilityName, interfaceFactory) {
    if (typeof interfaceFactory !== 'function') {
      throw new Error(`capability "${capabilityName}" provider must be a function`);
    }

    this.interfaceFactories.set(`${pluginId}:${capabilityName}`, interfaceFactory);
    this.cache.clear();
  }

  unbindProvider(pluginId) {
    for (const providerKey of Array.from(this.interfaceFactories.keys())) {
      if (providerKey.startsWith(`${pluginId}:`)) {
        this.interfaceFactories.delete(providerKey);
        this.providerInterfaces.delete(providerKey);
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
    const cacheKey = `${consumerId}:${capabilityName}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.isProviderActive(cached.providerId)) {
      return cached.interface;
    }

    const route = this.router?.route?.({
      consumerId,
      capabilityName,
      invocationKey: 'resolve'
    });
    const initialProviderId = this.router
      ? route?.providerId ?? null
      : this.registry.resolveCapabilityProvider(capabilityName, consumerId);
    if (!initialProviderId) {
      throw new Error(`[${consumerId}] capability provider not found: ${capabilityName}`);
    }

    this.getProviderInterface(initialProviderId, capabilityName);
    this.capabilityTrace?.recordResolution(capabilityName, initialProviderId, consumerId);
    const guarded = this.createGuardedInterface(consumerId, capabilityName);
    this.cache.set(cacheKey, { providerId: initialProviderId, interface: guarded });
    return guarded;
  }

  createGuardedInterface(consumerId, capabilityName) {
    return new Proxy(Object.create(null), {
      get: (_, memberKey) => {
        if (typeof memberKey !== 'string') {
          return undefined;
        }

        return async (...args) => {
          const route = this.router?.route?.({
            consumerId,
            capabilityName,
            invocationKey: memberKey
          });
          const providerId = this.router
            ? route?.providerId ?? null
            : this.registry.resolveCapabilityProvider(capabilityName, consumerId);
          if (!providerId) {
            throw new Error(`[${consumerId}] capability provider not found: ${capabilityName}`);
          }

          if (!this.isProviderActive(providerId)) {
            throw new Error(`[${consumerId}] capability provider is inactive: ${capabilityName}`);
          }

          const providerInterface = this.getProviderInterface(providerId, capabilityName);
          const member = providerInterface[memberKey];
          if (typeof member !== 'function') {
            throw new Error(`[${consumerId}] capability method unavailable: ${capabilityName}.${memberKey}`);
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
              member: memberKey,
              error: {
                message: error instanceof Error ? error.message : String(error)
              }
            });
            void Promise.resolve().then(() => this.healthReporter?.({
              pluginId: providerId,
              source: 'capability',
              capability: capabilityName,
              error
            }));
            throw error;
          }
        };
      }
    });
  }

  getProviderInterface(providerId, capabilityName) {
    const providerKey = `${providerId}:${capabilityName}`;
    const cached = this.providerInterfaces.get(providerKey);
    if (cached) {
      return cached;
    }

    const factory = this.interfaceFactories.get(providerKey);
    if (!factory) {
      throw new Error(`capability provider unavailable: ${capabilityName}`);
    }

    const providerRecord = this.registry.require(providerId);
    const rawInterface = factory({
      capability: capabilityName,
      providerId,
      manifest: providerRecord.manifest
    });

    assertCapabilityInterface(rawInterface, capabilityName);
    const frozen = Object.freeze({ ...rawInterface });
    this.providerInterfaces.set(providerKey, frozen);
    return frozen;
  }

  isProviderActive(pluginId) {
    return this.registry.get(pluginId)?.state === PluginState.ACTIVE;
  }
}
