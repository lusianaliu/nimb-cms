import { pluginManifest } from './manifest.ts';
import { contentCapabilities } from './capabilities/content.capability.ts';
import { articleSchema } from './schemas/article.schema.ts';
import { createContentLifecycleHooks } from './hooks/content.lifecycle.ts';

type Disposable = () => void;

type PluginContracts = {
  registerCapability: (definition: {
    key: string;
    version: string;
    description: string;
    source: string;
  }) => Disposable;
  registerSchema: (definition: {
    id: string;
    version: string;
    type: string;
    required: readonly string[];
    additionalProperties: boolean;
    properties: Record<string, unknown>;
    source: string;
  }) => Disposable;
  registerLifecycleHook: (definition: {
    name: 'onContentCreate' | 'beforeContentSave' | 'afterContentPublish';
    order: number;
    source: string;
    handler: (event: {
      hook: 'onContentCreate' | 'beforeContentSave' | 'afterContentPublish';
      entityType: string;
      payload: unknown;
    }) => Promise<void>;
  }) => Disposable;
  logger: {
    info: (message: string, metadata?: Record<string, unknown>) => void;
    warn: (message: string, metadata?: Record<string, unknown>) => void;
    error: (message: string, metadata?: Record<string, unknown>) => void;
  };
};

const assertContract = <K extends keyof PluginContracts>(
  contracts: Partial<PluginContracts>,
  key: K
): asserts contracts is PluginContracts => {
  if (typeof contracts[key] !== 'function' && key !== 'logger') {
    throw new Error(
      `[${pluginManifest.id}] missing required platform contract: ${String(key)}`
    );
  }

  if (key === 'logger' && (!contracts.logger || typeof contracts.logger.info !== 'function')) {
    throw new Error(`[${pluginManifest.id}] missing required platform contract: logger`);
  }
};

export const registerContentBasicPlugin = (contracts: Partial<PluginContracts>): Disposable => {
  assertContract(contracts, 'registerCapability');
  assertContract(contracts, 'registerSchema');
  assertContract(contracts, 'registerLifecycleHook');
  assertContract(contracts, 'logger');

  const disposables: Disposable[] = [];

  for (const capability of contentCapabilities) {
    const disposeCapability = contracts.registerCapability({
      ...capability,
      source: pluginManifest.id
    });
    disposables.push(disposeCapability);
  }

  disposables.push(
    contracts.registerSchema({
      ...articleSchema,
      source: pluginManifest.id
    })
  );

  for (const hook of createContentLifecycleHooks(contracts.logger)) {
    disposables.push(
      contracts.registerLifecycleHook({
        name: hook.name,
        order: hook.order,
        source: pluginManifest.id,
        handler: hook.handler
      })
    );
  }

  contracts.logger.info('content-basic plugin registered', {
    plugin: pluginManifest.id,
    capabilities: pluginManifest.declaredCapabilities.length,
    lifecycleHooks: pluginManifest.lifecycleHooks.length
  });

  return () => {
    for (const dispose of disposables.reverse()) {
      dispose();
    }

    contracts.logger.info('content-basic plugin unregistered', {
      plugin: pluginManifest.id
    });
  };
};

export const register = registerContentBasicPlugin;
export default registerContentBasicPlugin;
