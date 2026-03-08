const LEGACY_MANIFEST_FIELDS = new Set(['id', 'name', 'version', 'entry', 'apiVersion', 'capabilities']);
const SDK_MANIFEST_FIELDS = new Set(['name', 'version', 'main']);
const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PluginManifest {
  id: string
  name: string
  version: string
  entry: string
  apiVersion?: string
  capabilities?: string[]
}

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`plugin manifest field "${field}" must be a non-empty string`);
  }

  return value;
};

const normalizeCapabilities = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((capability) => typeof capability !== 'string')) {
    throw new Error('plugin manifest field "capabilities" must be an array of strings');
  }

  return [...value];
};

const validateLegacyManifest = (manifest: Record<string, unknown>): PluginManifest => {
  for (const key of Object.keys(manifest)) {
    if (!LEGACY_MANIFEST_FIELDS.has(key)) {
      throw new Error(`plugin manifest has unknown field "${key}"`);
    }
  }

  const id = asString(manifest.id, 'id');
  const entry = asString(manifest.entry, 'entry');
  const version = asString(manifest.version, 'version');
  const apiVersion = asString(manifest.apiVersion, 'apiVersion');

  if (!PLUGIN_ID_PATTERN.test(id)) {
    throw new Error('plugin manifest field "id" must be kebab-case');
  }

  return Object.freeze({
    id,
    name: typeof manifest.name === 'string' && manifest.name.trim().length > 0 ? manifest.name : id,
    version,
    entry,
    apiVersion,
    capabilities: normalizeCapabilities(manifest.capabilities)
  });
};

const validateSdkManifest = (manifest: Record<string, unknown>): PluginManifest => {
  for (const key of Object.keys(manifest)) {
    if (!SDK_MANIFEST_FIELDS.has(key)) {
      throw new Error(`plugin manifest has unknown field "${key}"`);
    }
  }

  const name = asString(manifest.name, 'name');

  if (!PLUGIN_ID_PATTERN.test(name)) {
    throw new Error('plugin manifest field "name" must be kebab-case');
  }

  return Object.freeze({
    id: name,
    name,
    version: asString(manifest.version, 'version'),
    entry: asString(manifest.main, 'main')
  });
};

export const validatePluginManifest = (value: unknown): PluginManifest => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('plugin manifest must be a JSON object');
  }

  const manifest = value as Record<string, unknown>;

  if (typeof manifest.main === 'string') {
    return validateSdkManifest(manifest);
  }

  return validateLegacyManifest(manifest);
};
