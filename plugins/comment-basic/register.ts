import { pluginManifest } from './manifest.ts';
import { commentCapabilities } from './capabilities/comment.capability.ts';
import { commentSchema } from './schemas/comment.schema.ts';
import { createCommentLifecycleHooks } from './hooks/comment.lifecycle.ts';

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
    name: 'onCommentCreate' | 'beforeCommentSave' | 'afterCommentPublish';
    order: number;
    source: string;
    handler: (event: {
      hook: 'onCommentCreate' | 'beforeCommentSave' | 'afterCommentPublish';
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
    throw new Error(`[${pluginManifest.id}] missing required platform contract: ${String(key)}`);
  }

  if (key === 'logger' && (!contracts.logger || typeof contracts.logger.info !== 'function')) {
    throw new Error(`[${pluginManifest.id}] missing required platform contract: logger`);
  }
};

export const registerCommentBasicPlugin = (contracts: Partial<PluginContracts>): Disposable => {
  assertContract(contracts, 'registerCapability');
  assertContract(contracts, 'registerSchema');
  assertContract(contracts, 'registerLifecycleHook');
  assertContract(contracts, 'logger');

  if (process.env.NIMB_ENABLE_COMMENT_BASIC !== 'true') {
    contracts.logger.info('comment-basic plugin registration skipped', {
      plugin: pluginManifest.id,
      reason: 'set NIMB_ENABLE_COMMENT_BASIC=true to activate reference registrations'
    });

    return () => {
      contracts.logger.info('comment-basic plugin unregistered (no-op)', {
        plugin: pluginManifest.id
      });
    };
  }

  const disposables: Disposable[] = [];

  for (const capability of commentCapabilities) {
    const disposeCapability = contracts.registerCapability({
      ...capability,
      source: pluginManifest.id
    });
    disposables.push(disposeCapability);
  }

  disposables.push(
    contracts.registerSchema({
      ...commentSchema,
      source: pluginManifest.id
    })
  );

  for (const hook of createCommentLifecycleHooks(contracts.logger)) {
    disposables.push(
      contracts.registerLifecycleHook({
        name: hook.name,
        order: hook.order,
        source: pluginManifest.id,
        handler: hook.handler
      })
    );
  }

  contracts.logger.info('comment-basic plugin registered', {
    plugin: pluginManifest.id,
    capabilities: pluginManifest.declaredCapabilities.length,
    lifecycleHooks: pluginManifest.lifecycleHooks.length
  });

  return () => {
    for (const dispose of disposables.reverse()) {
      dispose();
    }

    contracts.logger.info('comment-basic plugin unregistered', {
      plugin: pluginManifest.id
    });
  };
};

export const register = registerCommentBasicPlugin;
export default registerCommentBasicPlugin;
