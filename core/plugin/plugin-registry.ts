export interface LoadedPlugin {
  id: string
  name: string
  version: string
  path?: string
  entry?: string
  main?: string
}

const pluginRegistry = new Map<string, LoadedPlugin>();

export const registerPlugin = (plugin: LoadedPlugin): LoadedPlugin => {
  const pluginId = typeof plugin.id === 'string' && plugin.id.trim().length > 0
    ? plugin.id
    : plugin.name;

  const record = Object.freeze({ ...plugin, id: pluginId });
  pluginRegistry.set(pluginId, record);
  return record;
};

export const getPlugins = (): LoadedPlugin[] => Object.freeze([...pluginRegistry.values()]);

export type PluginRegistry = {
  get: (id: string) => LoadedPlugin | undefined
  list: () => LoadedPlugin[]
  register: (id: string, plugin: LoadedPlugin) => LoadedPlugin
}

export const createPluginRegistry = (): PluginRegistry => {
  const plugins = new Map<string, LoadedPlugin>();

  return Object.freeze({
    get: (id: string) => plugins.get(id),
    list: () => Object.freeze([...plugins.values()]),
    register: (id: string, plugin: LoadedPlugin) => {
      const record = registerPlugin({ ...plugin, id: plugin.id ?? id });
      plugins.set(id, record);
      return record;
    }
  });
};
