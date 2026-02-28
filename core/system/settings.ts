import type { Capability } from '../runtime/capabilities.ts';

const SETTINGS_CONTENT_TYPE = 'settings';

export const RESERVED_SETTINGS_KEYS = Object.freeze([
  'admin.theme',
  'admin.branding.title',
  'admin.branding.logoText',
  'admin.branding.logoUrl',
  'site.name',
  'site.version'
] as const);

export type ReservedSettingKey = (typeof RESERVED_SETTINGS_KEYS)[number];

const KEY_TO_FIELD = Object.freeze<Record<ReservedSettingKey, string>>({
  'admin.theme': 'adminTheme',
  'admin.branding.title': 'adminTitle',
  'admin.branding.logoText': 'logoText',
  'admin.branding.logoUrl': 'logoUrl',
  'site.name': 'siteName',
  'site.version': 'version'
});

const isReservedSettingKey = (key: string): key is ReservedSettingKey => RESERVED_SETTINGS_KEYS.includes(key as ReservedSettingKey);

const getMetadataStore = (runtime) => {
  if (!runtime.metadata || typeof runtime.metadata !== 'object') {
    runtime.metadata = {};
  }

  if (!runtime.metadata.settings || typeof runtime.metadata.settings !== 'object') {
    runtime.metadata.settings = {};
  }

  return runtime.metadata.settings as Record<string, unknown>;
};

const getSettingsEntry = (runtime) => {
  const entries = runtime?.contentStore?.list?.(SETTINGS_CONTENT_TYPE) ?? [];
  return entries[0];
};

export const getSetting = (runtime, key: ReservedSettingKey): unknown => {
  if (!isReservedSettingKey(key)) {
    throw new Error(`Unknown reserved setting key: ${String(key)}`);
  }

  const fieldName = KEY_TO_FIELD[key];
  const entry = getSettingsEntry(runtime);
  if (entry?.data && Object.prototype.hasOwnProperty.call(entry.data, fieldName)) {
    return entry.data[fieldName];
  }

  const metadataStore = getMetadataStore(runtime);
  return metadataStore[key];
};

export const setSetting = async (runtime, key: ReservedSettingKey, value: unknown) => {
  if (!isReservedSettingKey(key)) {
    throw new Error(`Unknown reserved setting key: ${String(key)}`);
  }

  const fieldName = KEY_TO_FIELD[key];
  const entry = getSettingsEntry(runtime);
  if (entry) {
    runtime.contentStore.update(SETTINGS_CONTENT_TYPE, entry.id, {
      ...entry.data,
      [fieldName]: `${value ?? ''}`
    });

    await runtime.persistContentSnapshot?.();
    return;
  }

  const metadataStore = getMetadataStore(runtime);
  metadataStore[key] = value;
};

export const getAllSettings = (runtime): Record<ReservedSettingKey, unknown> => Object.freeze(
  RESERVED_SETTINGS_KEYS.reduce((snapshot, key) => {
    snapshot[key] = getSetting(runtime, key);
    return snapshot;
  }, {} as Record<ReservedSettingKey, unknown>)
);

type SettingsModuleOptions = {
  requireCapability?: ((capability: Capability, operation: string) => void) | undefined
};

export const createSettingsModule = (runtime, options: SettingsModuleOptions = {}) => {
  const requireCapability = options.requireCapability;

  return Object.freeze({
    get: (key: ReservedSettingKey) => {
      requireCapability?.('settings.read', 'settings.get');
      return getSetting(runtime, key);
    },
    set: (key: ReservedSettingKey, value: unknown) => {
      requireCapability?.('settings.write', 'settings.set');
      return setSetting(runtime, key, value);
    },
    getAll: () => {
      requireCapability?.('settings.read', 'settings.getAll');
      return getAllSettings(runtime);
    }
  });
};
