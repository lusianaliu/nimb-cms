import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { NimbPlugin, NimbRuntime } from './plugin.ts';

type PluginLoaderLogger = {
  error?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
};

const PLUGIN_ENTRY_FILE = 'index.ts';

export const loadPlugins = async (
  runtime: NimbRuntime,
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

  const pluginDirectories = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of pluginDirectories) {
    const pluginName = entry.name;
    const pluginEntryPath = path.join(pluginsDirectory, pluginName, PLUGIN_ENTRY_FILE);

    const hasEntry = await fs.access(pluginEntryPath).then(() => true).catch(() => false);
    if (!hasEntry) {
      logger?.warn?.('plugin loader skipped plugin without index.ts entry', {
        plugin: pluginName,
        pluginEntryPath
      });
      continue;
    }

    try {
      const moduleUrl = pathToFileURL(pluginEntryPath).href;
      const imported = await import(moduleUrl);
      const plugin: NimbPlugin | undefined = imported.default ?? imported.plugin;

      if (!plugin || typeof plugin.setup !== 'function') {
        throw new Error('plugin entry must export a plugin object with a setup function');
      }

      await plugin.setup(runtime);
      loadedPlugins.push(plugin.name ?? pluginName);
    } catch (error) {
      logger?.error?.('plugin loader failed to load plugin', {
        plugin: pluginName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return loadedPlugins;
};
