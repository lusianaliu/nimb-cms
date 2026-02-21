import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PLUGIN_MANIFEST_FILE = 'plugin.json';

export class PluginLoader {
  constructor(options) {
    this.pluginsDirectory = options.pluginsDirectory;
    this.logger = options.logger;
    this.registry = new Map();
  }

  async discover() {
    const entries = await fs.readdir(this.pluginsDirectory, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT') {
        return [];
      }

      throw error;
    });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const pluginDirectory = path.join(this.pluginsDirectory, entry.name);
      const manifest = await this.loadManifest(pluginDirectory).catch((error) => {
        this.logger.warn('Skipping plugin manifest', {
          pluginDirectory,
          reason: error.message
        });
        return null;
      });

      if (!manifest) {
        continue;
      }

      const pluginId = manifest.id ?? entry.name;
      this.registry.set(pluginId, {
        id: pluginId,
        directory: pluginDirectory,
        manifest,
        enabled: manifest.enabled !== false,
        instance: null
      });
    }

    return this.list();
  }

  async registerEnabled(runtimeContext) {
    for (const pluginRecord of this.registry.values()) {
      if (!pluginRecord.enabled) {
        continue;
      }

      const plugin = await this.importPlugin(pluginRecord);
      if (typeof plugin.register === 'function') {
        await Promise.resolve(plugin.register(runtimeContext));
      }

      pluginRecord.instance = plugin;
    }
  }

  async bootEnabled(runtimeContext) {
    for (const pluginRecord of this.registry.values()) {
      if (!pluginRecord.enabled || !pluginRecord.instance) {
        continue;
      }

      if (typeof pluginRecord.instance.boot === 'function') {
        await Promise.resolve(pluginRecord.instance.boot(runtimeContext));
      }
    }
  }

  enable(pluginId) {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      return false;
    }

    plugin.enabled = true;
    return true;
  }

  disable(pluginId) {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      return false;
    }

    plugin.enabled = false;
    return true;
  }

  list() {
    return Array.from(this.registry.values()).map((plugin) => ({
      id: plugin.id,
      enabled: plugin.enabled,
      manifest: plugin.manifest
    }));
  }

  async loadManifest(pluginDirectory) {
    const manifestPath = path.join(pluginDirectory, PLUGIN_MANIFEST_FILE);
    const manifestData = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestData);

    if (!manifest.entry || typeof manifest.entry !== 'string') {
      throw new Error('Plugin manifest requires an entry string');
    }

    return manifest;
  }

  async importPlugin(pluginRecord) {
    const entryPath = path.join(pluginRecord.directory, pluginRecord.manifest.entry);
    const moduleUrl = pathToFileURL(entryPath).href;
    const loadedModule = await import(moduleUrl);

    const plugin = loadedModule.default ?? loadedModule.plugin ?? loadedModule;
    if (!plugin || typeof plugin !== 'object') {
      throw new Error(`Invalid plugin export for ${pluginRecord.id}`);
    }

    return plugin;
  }
}
