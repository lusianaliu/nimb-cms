import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePluginManifest } from './plugin-manifest.ts';

type PluginLoaderLogger = {
  error?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
};

const PLUGIN_MANIFEST_FILE = 'plugin.json';

type RuntimeWithPlugins = {
  createScopedRuntime: (pluginId: string, capabilities?: string[]) => unknown;
  plugins?: {
    get: (id: string) => unknown;
    list: () => unknown[];
    register?: (id: string, plugin: unknown) => void;
  };
};

const readManifest = async (pluginDirectory: string) => {
  const manifestPath = path.join(pluginDirectory, PLUGIN_MANIFEST_FILE);
  const content = await fs.readFile(manifestPath, 'utf8');
  return validatePluginManifest(JSON.parse(content) as unknown);
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
      const register = imported.default;

      if (typeof register !== 'function') {
        throw new Error('plugin entry must export a default register(runtime) function');
      }

      const scopedRuntime = runtime.createScopedRuntime(manifest.id, manifest.capabilities ?? []);
      await register(scopedRuntime);

      runtime.plugins?.register?.(manifest.id, Object.freeze({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        capabilities: Object.freeze([...(manifest.capabilities ?? [])]),
        entry: pluginEntryPath
      }));

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
