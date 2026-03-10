import fs from 'node:fs';
import path from 'node:path';
import type { Capability } from '../runtime/capabilities.ts';

const RUNTIME_SETTINGS_CACHE_KEY = '__nimbGlobalSettings';

export const DEFAULT_SITE_SETTINGS = Object.freeze({
  siteName: 'My Nimb Site',
  tagline: 'Just another Nimb site',
  homepageIntro: 'This homepage is ready for a company profile website. Create and publish pages like About, Services, and Contact from admin.',
  footerText: '',
  timezone: 'UTC',
  theme: 'default'
});

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

const KEY_TO_FIELD = Object.freeze<Record<ReservedSettingKey, keyof SiteSettings>>({
  'admin.theme': 'adminTheme',
  'admin.branding.title': 'adminTitle',
  'admin.branding.logoText': 'logoText',
  'admin.branding.logoUrl': 'logoUrl',
  'site.name': 'siteName',
  'site.version': 'siteVersion'
});

export type SiteSettings = {
  siteName: string,
  tagline: string,
  homepageIntro: string,
  footerText: string,
  timezone: string,
  theme: string,
  adminTheme?: string,
  adminTitle?: string,
  logoText?: string,
  logoUrl?: string,
  siteVersion?: string
};

const isReservedSettingKey = (key: string): key is ReservedSettingKey => RESERVED_SETTINGS_KEYS.includes(key as ReservedSettingKey);

const cloneSettings = (settings: SiteSettings): SiteSettings => JSON.parse(JSON.stringify(settings));

const normalizeText = (value: unknown, fallback: string) => {
  const text = `${value ?? ''}`.trim();
  return text ? text : fallback;
};

const normalizeOptionalText = (value: unknown) => {
  const text = `${value ?? ''}`.trim();
  return text ? text : undefined;
};

const normalizeSettings = (settings: Record<string, unknown> = {}): SiteSettings => {
  const normalized: SiteSettings = {
    siteName: normalizeText(settings.siteName, DEFAULT_SITE_SETTINGS.siteName),
    tagline: normalizeText(settings.tagline, DEFAULT_SITE_SETTINGS.tagline),
    homepageIntro: normalizeText(settings.homepageIntro, DEFAULT_SITE_SETTINGS.homepageIntro),
    footerText: normalizeText(settings.footerText, DEFAULT_SITE_SETTINGS.footerText),
    timezone: normalizeText(settings.timezone, DEFAULT_SITE_SETTINGS.timezone),
    theme: normalizeText(settings.theme, DEFAULT_SITE_SETTINGS.theme)
  };

  const adminTheme = normalizeOptionalText(settings.adminTheme);
  const adminTitle = normalizeOptionalText(settings.adminTitle);
  const logoText = normalizeOptionalText(settings.logoText);
  const logoUrl = normalizeOptionalText(settings.logoUrl);
  const siteVersion = normalizeOptionalText(settings.siteVersion);

  if (adminTheme) {
    normalized.adminTheme = adminTheme;
  }

  if (adminTitle) {
    normalized.adminTitle = adminTitle;
  }

  if (logoText) {
    normalized.logoText = logoText;
  }

  if (logoUrl) {
    normalized.logoUrl = logoUrl;
  }

  if (siteVersion) {
    normalized.siteVersion = siteVersion;
  }

  return normalized;
};

const resolveSettingsPath = (runtime): string => {
  const dataDir = runtime?.projectPaths?.dataDir ?? runtime?.project?.dataDir ?? path.resolve(process.cwd(), 'data');
  return path.resolve(dataDir, 'settings.json');
};

const readSettingsFromDisk = (runtime): SiteSettings => {
  const settingsPath = resolveSettingsPath(runtime);

  if (!fs.existsSync(settingsPath)) {
    return cloneSettings(DEFAULT_SITE_SETTINGS);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      return normalizeSettings(parsed as Record<string, unknown>);
    }
  } catch {
    // Fall back to defaults if settings file is malformed.
  }

  return cloneSettings(DEFAULT_SITE_SETTINGS);
};

const persistSettings = (runtime, settings: SiteSettings) => {
  const settingsPath = resolveSettingsPath(runtime);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
};

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

const loadRuntimeSettings = (runtime): SiteSettings => {
  const existing = runtime?.[RUNTIME_SETTINGS_CACHE_KEY];
  if (existing && typeof existing === 'object') {
    return normalizeSettings(existing as Record<string, unknown>);
  }

  const loaded = readSettingsFromDisk(runtime);
  runtime[RUNTIME_SETTINGS_CACHE_KEY] = loaded;
  persistSettings(runtime, loaded);

  return cloneSettings(loaded);
};

export const getSettings = (runtime): SiteSettings => cloneSettings(loadRuntimeSettings(runtime));

export const updateSettings = (runtime, data: Record<string, unknown> = {}): SiteSettings => {
  const current = loadRuntimeSettings(runtime);
  const next = normalizeSettings({
    ...current,
    ...data
  });

  runtime[RUNTIME_SETTINGS_CACHE_KEY] = next;
  persistSettings(runtime, next);

  return cloneSettings(next);
};

export const getSetting = (runtime, key: ReservedSettingKey): unknown => {
  if (!isReservedSettingKey(key)) {
    throw new Error(`Unknown reserved setting key: ${String(key)}`);
  }

  const fieldName = KEY_TO_FIELD[key];
  const settings = loadRuntimeSettings(runtime);
  if (Object.prototype.hasOwnProperty.call(settings, fieldName)) {
    return settings[fieldName];
  }

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
  updateSettings(runtime, { [fieldName]: value });

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

  loadRuntimeSettings(runtime);

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
    },
    getSettings: () => {
      requireCapability?.('settings.read', 'settings.getSettings');
      return getSettings(runtime);
    },
    updateSettings: (data: Record<string, unknown>) => {
      requireCapability?.('settings.write', 'settings.updateSettings');
      return updateSettings(runtime, data);
    }
  });
};
