export interface LoadedPlugin {
  name: string
  version: string
  path: string
  id?: string
}

export type PluginRegistry = {
  get: (id: string) => LoadedPlugin | undefined
  list: () => LoadedPlugin[]
  register: (id: string, plugin: LoadedPlugin) => LoadedPlugin
}

export const createPluginRegistry = (): PluginRegistry => {
  const plugins = new Map<string, LoadedPlugin>();

  return Object.freeze({
    get: (id: string) => plugins.get(id),
    list: () => Array.from(plugins.values()),
    register: (id: string, plugin: LoadedPlugin) => {
      const record = Object.freeze({ ...plugin, id: plugin.id ?? id });
      plugins.set(id, record);
      return record;
    }
  });
};
