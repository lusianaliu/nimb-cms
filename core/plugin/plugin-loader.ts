import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isCompatible } from './api-compat.ts';
import { PLUGIN_API_VERSION, type PluginAPI, type ScopedRuntime } from './plugin-api.ts';
import { type PluginManifest, validatePluginManifest } from './plugin-manifest.ts';

type PluginLoaderLogger = {
  error?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
};

const PLUGIN_MANIFEST_FILE = 'plugin.json';

type RuntimeWithPlugins = {
  createScopedRuntime: (pluginId: string, capabilities?: string[]) => ScopedRuntime;
  plugins?: {
    get: (id: string) => unknown;
    list: () => unknown[];
    register?: (id: string, plugin: unknown) => void;
  };
};

const readManifest = async (pluginDirectory: string): Promise<PluginManifest> => {
  const manifestPath = path.join(pluginDirectory, PLUGIN_MANIFEST_FILE);
  const content = await fs.readFile(manifestPath, 'utf8');
  return validatePluginManifest(JSON.parse(content) as unknown);
};

const runPluginLifecycle = async (
  imported: Record<string, unknown>,
  runtime: RuntimeWithPlugins,
  manifest: PluginManifest
) => {
  const activate = imported.activate;

  if (typeof activate === 'function') {
    await activate(runtime);
    return;
  }

  const register = imported.default;

  if (typeof register !== 'function') {
    throw new Error('plugin entry must export activate(runtime) or default register(api)');
  }

  if (manifest.apiVersion && !isCompatible(PLUGIN_API_VERSION, manifest.apiVersion)) {
    throw new Error(`plugin api version "${manifest.apiVersion}" is incompatible with core api "${PLUGIN_API_VERSION}"`);
  }

  const scopedRuntime = runtime.createScopedRuntime(manifest.id, manifest.capabilities ?? []);
  const pluginAPI: PluginAPI = Object.freeze({
    version: PLUGIN_API_VERSION,
    runtime: scopedRuntime
  });

  await register(Object.freeze({
    apiVersion: PLUGIN_API_VERSION,
    ...pluginAPI
  }));
};

export const loadPlugins = async (
  runtime: RuntimeWithPlugins,
  {
    pluginsDirectory = path.resolve(process.cwd(), 'plugins'),
    logger = console
  }: {
    pluginsDirectory?: string;
    logger?: PluginLoaderLogger;
  } = {}
): Promise<string[]> => {
  const entries = await fs.readdir(pluginsDirectory, { withFileTypes: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  });

  const loadedPlugins: string[] = [];

  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
    const pluginDirectory = path.join(pluginsDirectory, entry.name);

    try {
      const manifest = await readManifest(pluginDirectory);

      if (runtime.plugins?.get(manifest.id)) {
        logger?.warn?.('plugin loader skipped duplicate plugin id', { plugin: manifest.id });
        continue;
      }

      const pluginEntryPath = path.resolve(pluginDirectory, manifest.entry);
      const imported = await import(pathToFileURL(pluginEntryPath).href);

      await runPluginLifecycle(imported as Record<string, unknown>, runtime, manifest);

      const metadata: Record<string, unknown> = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        entry: pluginEntryPath,
        apiVersion: manifest.apiVersion,
        capabilities: Object.freeze([...(manifest.capabilities ?? [])])
      };

      if (!manifest.apiVersion) {
        metadata.path = pluginDirectory;
      }

      runtime.plugins?.register?.(manifest.id, Object.freeze(metadata));

      loadedPlugins.push(manifest.id);
    } catch (error) {
      logger?.error?.('plugin loader failed to load plugin', {
        plugin: entry.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return loadedPlugins;
};
