const MANIFEST_FIELDS = new Set(['id', 'name', 'version', 'entry', 'capabilities']);
const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PluginManifest {
  id: string
  name: string
  version: string
  entry: string
  capabilities?: string[]
}

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`plugin manifest field "${field}" must be a non-empty string`);
  }

  return value;
};

export const validatePluginManifest = (value: unknown): PluginManifest => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('plugin manifest must be a JSON object');
  }

  const manifest = value as Record<string, unknown>;

  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_FIELDS.has(key)) {
      throw new Error(`plugin manifest has unknown field "${key}"`);
    }
  }

  const id = asString(manifest.id, 'id');
  const entry = asString(manifest.entry, 'entry');
  const version = asString(manifest.version, 'version');

  if (!PLUGIN_ID_PATTERN.test(id)) {
    throw new Error('plugin manifest field "id" must be kebab-case');
  }

  let capabilities: string[] | undefined;
  if (manifest.capabilities !== undefined) {
    if (!Array.isArray(manifest.capabilities) || manifest.capabilities.some((capability) => typeof capability !== 'string')) {
      throw new Error('plugin manifest field "capabilities" must be an array of strings');
    }

    capabilities = [...manifest.capabilities];
  }

  return Object.freeze({
    id,
    name: typeof manifest.name === 'string' && manifest.name.trim().length > 0 ? manifest.name : id,
    version,
    entry,
    capabilities
  });
};
