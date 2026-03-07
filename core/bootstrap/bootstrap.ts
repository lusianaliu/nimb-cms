import path from 'node:path';
import { loadConfig } from '../config/config-loader.ts';
import { createRuntime } from './runtime-factory.ts';
import { BootstrapSnapshot } from './bootstrap-snapshot.ts';
import { disposeRuntime } from '../runtime/dispose.ts';
import { FileSystemStorageAdapter, PersistenceEngine } from '../persistence/index.ts';
import { AuthService, SessionStore, createAuthMiddleware } from '../auth/index.ts';
import { createAuthService } from '../auth/auth-service.ts';
import { createSessionService } from '../auth/session-service.ts';
import { createAdminAuthMiddleware } from '../auth/admin-auth-middleware.ts';
import { CommandDispatcher, createAdminController } from '../admin/index.ts';
import { registerAdminPage, getAdminPages } from '../admin/admin-registry.ts';
import { registerAdminTheme, getAdminTheme, getDefaultAdminTheme } from '../admin/admin-theme-registry.ts';
import { createAdminNavRegistry } from '../admin/admin-nav-registry.ts';
import { createAdminMiddlewareRegistry } from '../admin/admin-middleware.ts';
import type { Middleware, MiddlewareContext } from '../http/middleware.ts';
import { createDefaultAdminTheme } from '../admin/themes/default-theme.ts';
import { ContentRegistry, ContentStore, ContentQueryService, ContentCommandService, EntryRegistry, ContentTypeRegistry, registerDefaultContentTypes, type ContentEvents } from '../content/index.ts';
import { createProjectModel, createProjectPaths } from '../project/index.ts';
import { resolveRuntimeMode } from '../runtime/resolve-runtime-mode.ts';
import { version } from '../runtime/version.ts';
import { resolveAdminBasePath } from '../admin/resolve-admin-path.ts';
import type { StorageAdapter as ContentStorageAdapter } from '../storage/storage-adapter.ts';
import { JsonStorageAdapter } from '../storage/json-storage-adapter.ts';
import { EventEmitter, createEventBus } from '../events/event-bus.ts';
import { HookRegistry } from '../hooks/index.ts';
import { loadPlugins } from '../plugin/plugin-loader.ts';
import type { BootstrapMode } from './bootstrap-mode.ts';
import { seedSystem } from '../setup/system-seed.ts';
import { createThemeManager } from '../theme/theme-manager.ts';
import { createThemeRenderer } from '../theme/theme-renderer.ts';
import { createSettingsModule } from '../system/settings.ts';
import { createMediaService } from '../media/media-service.ts';
import type { Capability } from '../runtime/capabilities.ts';
import type { ScopedRuntime } from '../plugin/plugin-api.ts';
import { getInstallState } from '../system/system-config.ts';


const CONTENT_TYPES_STORAGE_KEY = 'content-types';
const normalizeContentTypeSnapshot = (snapshot) => {
  const types = Array.isArray(snapshot?.types)
    ? [...snapshot.types].sort((left, right) => String(left?.name ?? '').localeCompare(String(right?.name ?? '')))
    : [];

  return Object.freeze({
    schemaVersion: String(snapshot?.schemaVersion ?? 'v1'),
    types: Object.freeze(types)
  });
};


const createCapabilityGuard = (capabilities: Capability[]) => {
  const allowed = new Set(capabilities);

  return (capability: Capability, operation: string) => {
    if (allowed.has(capability)) {
      return;
    }

    throw new Error(`Missing capability "${capability}" for runtime operation "${operation}"`);
  };
};

const createScopedRuntime = (runtime, pluginId: string, capabilities: Capability[]): ScopedRuntime => {
  const grantedCapabilities = Object.freeze([...(capabilities ?? [])]);
  const requireCapability = createCapabilityGuard(grantedCapabilities as Capability[]);
  const allowedDomains = new Set<string>();

  for (const capability of grantedCapabilities) {
    const [domain] = String(capability).split('.');
    if (domain) {
      allowedDomains.add(domain);
    }
  }

  const validateHookDomain = (hookName: string) => {
    const [domain] = String(hookName).split('.');
    if (!domain || !allowedDomains.has(domain)) {
      throw new Error(`Plugin "${pluginId}" cannot register hook "${hookName}" outside allowed domains: ${[...allowedDomains].sort().join(', ') || 'none'}`);
    }
  };

  return Object.freeze({
    capabilities: grantedCapabilities,
    admin: Object.freeze({
      navRegistry: runtime.admin?.navRegistry,
      middleware: runtime.admin?.middleware
    }),
    settings: createSettingsModule(runtime, { requireCapability }),
    hooks: Object.freeze({
      register: (hookName: string, handler: (value: unknown, context: Record<string, unknown>) => unknown | Promise<unknown>) => {
        validateHookDomain(hookName);
        return runtime.hooks.register(hookName, handler, { pluginId });
      },
      execute: (hookName: string, initialValue: unknown, context: Record<string, unknown>) => runtime.hooks.execute(hookName, initialValue, context)
    }),
    events: Object.freeze({
      on: (eventName: string, handler: (payload: unknown, context: { pluginId: string; timestamp: string }) => unknown) => runtime.events.on(eventName, handler),
      off: (eventName: string, handler: (payload: unknown, context: { pluginId: string; timestamp: string }) => unknown) => runtime.events.off(eventName, handler),
      emit: (eventName: string, payload: unknown) => runtime.events.emit(eventName, payload, { pluginId })
    }),
    plugins: Object.freeze({
      get: (id: string) => runtime.plugins?.get(id),
      list: () => runtime.plugins?.list() ?? []
    })
  });
};

const toRuntimeStatus = (runtime) => {
  const state = runtime.getState?.();
  return state?.derivedStatus?.systemHealthy === true ? 'healthy' : 'degraded';
};

const serializeContentStore = (contentStore, contentTypes) => {
  const entries = {};

  for (const type of contentTypes.list()) {
    const typeSlug = String(type?.slug ?? '');
    if (!typeSlug) {
      continue;
    }

    const serializedEntries = {};
    for (const entry of contentStore.list(typeSlug)) {
      serializedEntries[entry.id] = {
        id: entry.id,
        type: entry.type,
        data: { ...(entry.data ?? {}) },
        createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
        updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : entry.updatedAt
      };
    }

    if (Object.keys(serializedEntries).length > 0) {
      entries[typeSlug] = serializedEntries;
    }
  }

  return Object.freeze({ entries: Object.freeze(entries) });
};

const restoreContentStore = async (contentStore, snapshot) => {
  const entriesByType = snapshot?.entries ?? {};

  for (const [typeSlug, entries] of Object.entries(entriesByType)) {
    if (!entries || typeof entries !== 'object') {
      continue;
    }

    for (const [entryId, serialized] of Object.entries(entries)) {
      if (!serialized || typeof serialized !== 'object') {
        continue;
      }

      try {
        const restored = contentStore.create(typeSlug, { ...(serialized as { data?: Record<string, unknown> }).data ?? {} });
        restored.createdAt = new Date((serialized as { createdAt?: string }).createdAt ?? restored.createdAt);
        restored.updatedAt = new Date((serialized as { updatedAt?: string }).updatedAt ?? restored.updatedAt);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('Unknown content type:')) {
          throw error;
        }
      }
    }
  }
};


const isDistRuntimePath = (inputPath: string) => {
  const normalized = path.resolve(inputPath).split(path.sep).filter(Boolean);
  return normalized.includes('dist');
};

const resolveBootstrapProject = ({ cwd, project }: { cwd?: string | undefined; project: ReturnType<typeof createProjectModel> }) => {
  if (cwd && isDistRuntimePath(cwd)) {
    return createProjectModel({ projectRoot: cwd });
  }

  return cwd ? createProjectModel({ projectRoot: cwd }) : project;
};

export type CreateBootstrapOptions = {
  project?: ReturnType<typeof createProjectModel>
  cwd?: string | undefined
  startupTimestamp?: string
  contentStorageAdapter?: ContentStorageAdapter
  mode?: BootstrapMode
};

export const createBootstrap = async ({
  project = createProjectModel(),
  cwd = undefined,
  startupTimestamp = new Date().toISOString(),
  contentStorageAdapter = undefined,
  mode
}: CreateBootstrapOptions = {}) => {
  const resolvedProject = resolveBootstrapProject({ cwd, project });
  const resolvedPaths = createProjectPaths(resolvedProject.projectRoot ?? resolvedProject.root);
  const installState = getInstallState({ projectRoot: resolvedPaths.projectRoot, runtimeVersion: version });
  const selectedMode = mode ?? (installState.installed === true ? 'runtime' : 'install');
  const config = loadConfig({ cwd: resolvedPaths.projectRoot });
  const runtimeMode = resolveRuntimeMode(resolvedPaths);
  const runtime = createRuntime(config, resolvedPaths, { runtimeMode });
  runtime.dispose = () => disposeRuntime(runtime);
  runtime.mode = selectedMode;
  runtime.contentTypes = new ContentTypeRegistry();
  registerDefaultContentTypes(runtime.contentTypes);
  runtime.projectPaths = resolvedPaths;
  runtime.project = resolvedPaths;
  runtime.version = version;
  runtime.system = Object.freeze({
    config: installState.config,
    installed: installState.installed
  });
  runtime.setRuntimeMode?.(runtimeMode);
  runtime.setConfig?.(config);
  runtime.adminBasePath = resolveAdminBasePath(runtime);
  const navRegistry = createAdminNavRegistry();
  const middlewareRegistry = createAdminMiddlewareRegistry();
  const adminContextMiddleware: Middleware = async (ctx: MiddlewareContext, next) => {
    ctx.state.admin = true;
    await next();
  };
  middlewareRegistry.use(adminContextMiddleware);

  runtime.auth = createAuthService(runtime);
  runtime.sessions = createSessionService(runtime);
  const adminAuthMiddleware = createAdminAuthMiddleware(runtime);
  middlewareRegistry.use(adminAuthMiddleware);

  runtime.admin = Object.freeze({
    basePath: runtime.adminBasePath,
    title: runtime?.getConfig?.()?.admin?.title ?? 'Nimb Admin',
    navRegistry,
    middleware: middlewareRegistry
  });
  navRegistry.register({
    id: 'content',
    label: 'Content',
    path: '/admin/content/page',
    order: 10
  });
  navRegistry.register({
    id: 'media',
    label: 'Media',
    path: '/admin/media',
    order: 20
  });
  navRegistry.register({
    id: 'settings',
    label: 'Settings',
    path: '/admin/settings',
    order: 30
  });
  runtime.adminApi = Object.freeze({
    basePath: '/admin-api'
  });
  try {
    registerAdminTheme(createDefaultAdminTheme());
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Admin theme already registered:')) {
      throw error;
    }
  }
  runtime.adminTheme = 'default';
  runtime.adminBranding = Object.freeze({ adminTitle: 'Nimb Admin', logoText: 'Nimb' });
  runtime.adminThemes = Object.freeze({
    register: registerAdminTheme,
    get: getAdminTheme,
    getDefault: getDefaultAdminTheme
  });
  registerAdminPage({ id: 'dashboard', path: '/admin', title: 'Dashboard' });
  runtime.adminRegistry = Object.freeze({ registerAdminPage, getAdminPages });
  const resolvedContentStorageAdapter = contentStorageAdapter ?? new JsonStorageAdapter({ rootDirectory: resolvedPaths.dataDir });
  const storageAdapter = new FileSystemStorageAdapter({ rootDirectory: resolvedPaths.persistenceDir });
  const persistenceEngine = new PersistenceEngine({ storageAdapter });
  const sessionStore = new SessionStore({ storageAdapter });
  const authService = new AuthService({
    sessionStore,
    mode: config?.runtime?.mode ?? 'development',
    onStateChange: (status) => runtime.setAuthStatus?.(status)
  });
  const authMiddleware = createAuthMiddleware({ authService });
  const contentRegistry = new ContentRegistry();
  const entryRegistry = new EntryRegistry({ contentRegistry, rootDirectory: resolvedPaths.projectRoot });

  runtime.contentStore = new ContentStore(runtime.contentTypes, { rootDirectory: resolvedPaths.dataContentDir });
  runtime.contentQuery = new ContentQueryService(runtime.contentStore);
  runtime.settings = createSettingsModule(runtime);
  runtime.createScopedRuntime = (pluginOrCapabilities: string | Capability[] = [], maybeCapabilities: Capability[] = []) => {
    const pluginId = typeof pluginOrCapabilities === 'string' ? pluginOrCapabilities : 'runtime.system';
    const capabilities = Array.isArray(pluginOrCapabilities) ? pluginOrCapabilities : maybeCapabilities;
    return createScopedRuntime(runtime, pluginId, capabilities);
  };
  const pluginRegistry = new Map<string, Record<string, unknown>>();
  runtime.plugins = Object.freeze({
    get: (id: string) => pluginRegistry.get(id),
    list: () => Array.from(pluginRegistry.values()),
    register: (id: string, plugin: Record<string, unknown>) => {
      pluginRegistry.set(id, Object.freeze({ ...(plugin ?? {}), id }));
    }
  });
  runtime.eventBus = new EventEmitter<ContentEvents>();
  runtime.events = createEventBus();
  runtime.events.on('system.installed', () => {
    seedSystem(runtime);
  });
  runtime.hooks = new HookRegistry();
  runtime.theme = createThemeManager(runtime);
  runtime.themeRenderer = createThemeRenderer(runtime);

  const persistContentSnapshot = async () => {
    await resolvedContentStorageAdapter.saveContentSnapshot(serializeContentStore(runtime.contentStore, runtime.contentTypes));
  };

  runtime.persistContentSnapshot = persistContentSnapshot;
  runtime.contentCommand = new ContentCommandService(runtime.contentStore, runtime.persistContentSnapshot, runtime.eventBus, runtime.hooks);
  runtime.renderCache = Object.freeze({
    invalidate: () => undefined
  });
  runtime.media = createMediaService(runtime);
  runtime.content = Object.freeze({
    listEntries: (typeSlug: string) => runtime.contentQuery.list(typeSlug),
    getEntry: (typeSlug: string, id: string) => runtime.contentQuery.get(typeSlug, id),
    getTypeSchema: (typeSlug: string) => runtime.contentTypes.get(typeSlug),
    createEntry: async (typeSlug: string, data: Record<string, unknown>) => runtime.contentCommand.create(typeSlug, data),
    updateEntry: async (typeSlug: string, id: string, data: Record<string, unknown>) => runtime.contentCommand.update(typeSlug, id, data),
    deleteEntry: async (typeSlug: string, id: string) => runtime.contentCommand.delete(typeSlug, id),
    create: async (typeSlug: string, data: Record<string, unknown>) => runtime.contentCommand.create(typeSlug, data),
    update: async (typeSlug: string, id: string, data: Record<string, unknown>) => runtime.contentCommand.update(typeSlug, id, data),
    delete: async (typeSlug: string, id: string) => runtime.contentCommand.delete(typeSlug, id),
    get: (typeSlug: string, id: string) => runtime.contentQuery.get(typeSlug, id),
    list: (typeSlug: string) => runtime.contentQuery.list(typeSlug),
    invalidateRenderCache: () => runtime.renderCache?.invalidate?.()
  });


  if (runtime.system?.installed === true) {
    const defaultAdminEmail = 'admin@nimb.local';
    const existingAdmin = await runtime.auth.findUserByEmail(defaultAdminEmail);
    if (!existingAdmin) {
      await runtime.auth.createUser({
        username: 'admin',
        email: defaultAdminEmail,
        password: 'admin'
      });
    }
  }


  const restore = async () => {
    const restored = await persistenceEngine.restore();
    runtime.setRestoredState?.(restored.runtime);
    runtime.setPersistenceStatus?.(persistenceEngine.status());

    const restoredSchemas = normalizeContentTypeSnapshot(await storageAdapter.read(CONTENT_TYPES_STORAGE_KEY));
    for (const schema of restoredSchemas.types) {
      contentRegistry.register(schema, { source: 'restore' });
    }

    entryRegistry.restoreFromDisk();

    const snapshot = await resolvedContentStorageAdapter.loadContentSnapshot();
    await restoreContentStore(runtime.contentStore, snapshot);
  };

  const persist = async () => {
    const inspector = runtime.getInspector();
    await persistenceEngine.persist({
      schemaVersion: 'v1',
      runtime: runtime.getState(),
      goals: inspector.goals(),
      orchestrator: inspector.orchestrator()
    });
    runtime.setPersistenceStatus?.(persistenceEngine.status());
  };

  const persistContentTypes = async () => {
    const snapshot = normalizeContentTypeSnapshot({
      schemaVersion: 'v1',
      types: contentRegistry.list()
    });

    await storageAdapter.write(CONTENT_TYPES_STORAGE_KEY, snapshot);
    return snapshot;
  };

  const persistEntries = async () => entryRegistry.persist();

  await restore();
  await authService.restore();
  await runtime.start();

  if (selectedMode === 'runtime' && installState.installed === true) {
    seedSystem(runtime);
  }

  const shouldLoadPlugins = selectedMode !== 'install';
  if (shouldLoadPlugins) {
    await loadPlugins(runtime, { pluginsDirectory: resolvedPaths.pluginsDir });
  }

  await runtime.events.emit('admin.nav.register', Object.freeze({
    navRegistry: runtime.admin.navRegistry
  }));

  await runtime.events.emit('admin.middleware.register', Object.freeze({
    middleware: runtime.admin.middleware
  }));

  const dispatcher = new CommandDispatcher({
    executor: {
      execute: async (command) => runtime.executeAdminCommand({
        ...command,
        execute: {
          restart: async () => {
            await runtime.start();

            return Object.freeze({ restarted: true });
          },
          persist: async () => {
            await persist();
            return Object.freeze({ persisted: true, persistence: runtime.getInspector().persistence() });
          },
          reconcile: async () => {
            const goals = await runtime.goalEngine.evaluateCycle();
            return Object.freeze({ reconciled: true, goals });
          }
        }
      })
    }
  });

  runtime.setAdminStatusProvider?.(() => dispatcher.status());
  runtime.setAdminExecutor?.(async (command) => {
    if (command.action === 'runtime.restart') {
      const outcome = await command.execute.restart();
      return Object.freeze({ success: true, action: command.action, outcome });
    }

    if (command.action === 'runtime.persist') {
      const outcome = await command.execute.persist();
      return Object.freeze({ success: true, action: command.action, outcome });
    }

    if (command.action === 'goals.reconcile') {
      const outcome = await command.execute.reconcile();
      return Object.freeze({ success: true, action: command.action, outcome });
    }

    return Object.freeze({ success: false, action: command.action, outcome: Object.freeze({ reason: 'unsupported-command' }) });
  });

  const adminController = createAdminController({ dispatcher });
  runtime.authService = authService;
  runtime.authMiddleware = authMiddleware;
  runtime.adminController = adminController;
  runtime.contentRegistry = contentRegistry;
  runtime.persistContentTypes = persistContentTypes;
  runtime.entryRegistry = entryRegistry;
  runtime.persistEntries = persistEntries;

  const inspector = runtime.getInspector();
  const pluginIds = inspector.snapshot().plugins.map((plugin) => plugin.id).filter(Boolean);
  const diagnostics = inspector.snapshot().diagnostics;
  const bootstrapSnapshot = BootstrapSnapshot.create({
    config,
    startupTimestamp,
    runtimeStatus: toRuntimeStatus(runtime),
    loadedPlugins: pluginIds,
    diagnostics
  });

  runtime.setBootstrapSnapshot?.(bootstrapSnapshot);

  await persist();
  await persistContentSnapshot();
  await persistContentTypes();
  await persistEntries();
  runtime.setContentStatusProvider?.(() => contentRegistry.inspectorSnapshot());
  runtime.setEntryStatusProvider?.(() => entryRegistry.inspectorSnapshot());
  runtime.setEntryQueryStatusProvider?.(() => entryRegistry.queryInspectorSnapshot());

  return Object.freeze({
    config,
    runtime,
    hooks: runtime.hooks,
    snapshot: bootstrapSnapshot,
    inspector,
    persistence: persistenceEngine.status(),
    authService,
    authMiddleware,
    adminController,
    contentRegistry,
    contentStore: runtime.contentStore,
    contentCommand: runtime.contentCommand,
    contentQuery: runtime.contentQuery,
    persistContentSnapshot,
    persistContentTypes,
    entryRegistry,
    persistEntries,
    runtimeMode
  });
};

export const bootstrap = async (options: { mode?: BootstrapMode } = {}) => createBootstrap(options);
