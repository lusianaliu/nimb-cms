export type Disposable = () => void;

export type CapabilityDefinition = {
  key: string;
  version: string;
  description: string;
};

export type CapabilityInterface = Record<string, (...args: unknown[]) => unknown | Promise<unknown>>;

export type CapabilityProviderFactory = () => CapabilityInterface;

export type SchemaDefinition = {
  id: string;
  version: string;
  type: string;
  required: readonly string[];
  additionalProperties: boolean;
  properties: Record<string, unknown>;
};


export type PluginStateApi = {
  define: (name: string, initialValue: unknown) => void;
  update: (name: string, updater: (currentValue: unknown) => unknown | Promise<unknown>) => Promise<unknown>;
  get: (name: string) => unknown;
  subscribe: (
    name: string,
    handler: (value: unknown, metadata: { name: string; owner: string; previousValue: unknown }) => void | Promise<void>
  ) => Disposable;
};

export type RuntimeLifecycleEvent = {
  hook: string;
  entityType: string;
  payload: unknown;
};

export type RuntimeLifecycleDefinition = {
  name: string;
  order?: number;
  handler: (event: RuntimeLifecycleEvent, context: PluginContext) => void | Promise<void>;
};

export type LifecycleDefinition = {
  onStart?: (context: PluginContext) => void | Promise<void>;
  onStop?: (context: PluginContext) => void | Promise<void>;
  hooks?: readonly RuntimeLifecycleDefinition[];
};

export type PluginDefinition = {
  name: string;
  version: string;
  capabilities?: readonly CapabilityDefinition[];
  exportedEvents?: readonly string[];
  exportedCapabilities?: Record<string, CapabilityProviderFactory>;
  schemas?: readonly SchemaDefinition[];
  lifecycle?: LifecycleDefinition;
};

export type PluginContext = {
  pluginId: string;
  pluginVersion: string;
  useCapability: (name: string) => CapabilityInterface;
  emit: (eventName: string, payload: unknown) => Promise<void>;
  on: (eventName: string, handler: (payload: unknown, metadata: { eventName: string; publisher: string; subscriber: string }) => void | Promise<void>) => Disposable;
  state: PluginStateApi;
  logger: {
    info: (message: string, metadata?: Record<string, unknown>) => void;
    warn: (message: string, metadata?: Record<string, unknown>) => void;
    error: (message: string, metadata?: Record<string, unknown>) => void;
  };
};

export type RuntimeContracts = {
  registerCapability: (definition: CapabilityDefinition & { source: string }) => Disposable;
  registerSchema: (definition: SchemaDefinition & { source: string }) => Disposable;
  registerLifecycleHook: (definition: {
    name: string;
    order: number;
    source: string;
    handler: (event: RuntimeLifecycleEvent) => Promise<void>;
  }) => Disposable;
  useCapability: (name: string) => CapabilityInterface;
  emit: PluginContext['emit'];
  on: PluginContext['on'];
  state: PluginContext['state'];
  logger: PluginContext['logger'];
};

export type SDKPlugin = {
  pluginManifest: {
    id: string;
    version: string;
    entrypoints: {
      register: string;
    };
    declaredCapabilities: string[];
    exportedEvents: string[];
    exportedCapabilities: Record<string, CapabilityProviderFactory>;
    requiredPlatformContracts: Record<string, string>;
  };
  register: (contracts: Partial<RuntimeContracts>) => Promise<Disposable>;
};
