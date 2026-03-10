// INTERNAL: runtime/plugin-runtime loader is for plugin-runtime internals only.
// Phase 144 lock-in keeps CMS startup plugin loading in core/plugin/plugin-loader.ts.

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MANIFEST_FILE_NAME = 'manifest.ts';

export class PluginLoader {
  constructor(options = {}) {
    this.pluginsDirectory = options.pluginsDirectory ?? path.resolve(process.cwd(), 'plugins');
    this.logger = options.logger;
  }

  async discover() {
    const entries = await fs.readdir(this.pluginsDirectory, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT') {
        return [];
      }

      throw error;
    });

    const descriptors = [];
    const sortedEntries = entries.filter((entry) => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of sortedEntries) {
      const pluginDirectory = path.join(this.pluginsDirectory, entry.name);
      const manifestPath = path.join(pluginDirectory, MANIFEST_FILE_NAME);
      const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
      if (!hasManifest) {
        this.logger?.warn?.('plugin.runtime.discovery.skipped', {
          pluginDirectory,
          reason: 'manifest.ts not found'
        });
        continue;
      }

      descriptors.push({
        id: entry.name,
        directory: pluginDirectory,
        manifestPath
      });
    }

    return descriptors;
  }

  async loadManifest(descriptor) {
    const moduleUrl = pathToFileURL(descriptor.manifestPath).href;
    const loadedModule = await import(moduleUrl);
    return loadedModule.pluginManifest ?? loadedModule.default;
  }

  async loadRegisterEntrypoint(descriptor, manifest) {
    const entryPath = path.resolve(descriptor.directory, manifest.entrypoints.register);
    const moduleUrl = pathToFileURL(entryPath).href;
    const loadedModule = await import(moduleUrl);

    const registerFunction = typeof loadedModule.default === 'function'
      ? loadedModule.default
      : loadedModule.register;
    if (typeof registerFunction !== 'function') {
      throw new Error('register entrypoint must export a function');
    }

    return registerFunction;
  }
}
